import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { OrderStatus, NdrRecord, ShipmentContactType } from '@/lib/types';
import { triggerWhatsAppNotification } from '@/lib/whatsapp';
import { bookOrderCourierShipment } from '@/lib/courierReliability';
import { isShipmentContactType, resolveShipmentContact } from '@/lib/shipmentContact';
import { hasAllowedRole } from '@/lib/session';
import { getActiveSession } from '@/lib/authorization';
import { normalizeCustomerWhatsAppNumber } from '@/lib/customerPhone';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await getActiveSession(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { id } = await params;
    const order = await db.getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    const allLogs = await db.getWhatsAppLogs();
    const orderLogs = allLogs.filter(log => 
      log.orderId === order.orderId ||
      log.phone === order.phonePrimary ||
      log.phone === order.phoneSecondary ||
      log.phone === order.phoneWhatsApp
    );
    return NextResponse.json({ success: true, order, logs: orderLogs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch order.' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getActiveSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    const { 
      status, 
      remarks,
      courier, 
      awb, 
      eta,
      partiallyPaidAmount,
      feNumber,
      assignedTo,
      inNdrWorkingSheet,
      ndrAction,
      futureDeliveryDate,
      isVip,
      shipmentContactPhone,
      shipmentContactType
    } = body;

    const order = await db.getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const previousStatus = order.status;
    const now = new Date().toISOString();
    const targetStatus = status || previousStatus;
    const statusChanged = Boolean(status && targetStatus !== previousStatus);
    const waTriggerStatuses = ['Label Generated', 'Dispatched', 'OFD', 'Delivered', 'NDR', 'Return'];
    if (statusChanged && waTriggerStatuses.includes(targetStatus) && !normalizeCustomerWhatsAppNumber(order.phoneWhatsApp)) {
      return NextResponse.json({ error: 'A valid customer WhatsApp number is required before this status change.' }, { status: 400 });
    }
    let selectedShipmentContact: { type: ShipmentContactType; phone: string } | null = null;

    if (targetStatus === 'Label Generated' && !order.awb) {
      const requestedContactType: ShipmentContactType = shipmentContactType === undefined
        ? (shipmentContactPhone ? 'Custom' : 'Primary')
        : shipmentContactType;

      if (!isShipmentContactType(requestedContactType)) {
        return NextResponse.json({ error: 'Invalid shipmentContactType.' }, { status: 400 });
      }

      try {
        selectedShipmentContact = resolveShipmentContact(
          order,
          requestedContactType,
          requestedContactType === 'Custom' ? shipmentContactPhone : undefined,
        );
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Invalid shipment contact number.' },
          { status: 400 },
        );
      }
    }

    // 1. Update status and tracking details
    order.status = targetStatus as OrderStatus;
    order.updatedAt = now;
    if (courier) order.courier = courier;
    if (awb !== undefined) order.awb = awb || undefined;
    if (eta !== undefined) order.eta = eta || undefined;

    // Additional requirement fields
    if (partiallyPaidAmount !== undefined) {
      order.partiallyPaidAmount = parseFloat(partiallyPaidAmount);
      order.finalPayableAmount = order.orderValue - order.partiallyPaidAmount;
    }
    if (feNumber !== undefined) order.feNumber = feNumber;
    if (inNdrWorkingSheet !== undefined) order.inNdrWorkingSheet = !!inNdrWorkingSheet;
    if (ndrAction !== undefined) order.ndrAction = ndrAction;
    if (futureDeliveryDate !== undefined) order.futureDeliveryDate = futureDeliveryDate || undefined;
    if (isVip !== undefined) order.isVip = !!isVip;

    // 2. Perform automated workflow integrations based on status changes
    let systemRemarks = remarks || `Status transitioned from ${previousStatus} to ${targetStatus}.`;
    if (isVip !== undefined && !remarks) {
      systemRemarks = `Order VIP status updated to ${isVip ? 'Enabled' : 'Disabled'}.`;
    }

    if (assignedTo !== undefined && assignedTo !== order.assignedTo) {
      const prevAssignee = order.assignedTo || 'Unassigned';
      order.assignedTo = assignedTo;
      systemRemarks = remarks || `Order reassigned from ${prevAssignee} to ${assignedTo || 'Unassigned'}.`;
    }

    const baseUrl = new URL(request.url).origin;

    // A. PACKING queue -> Trigger Auto AWB generation if not yet allocated
    let awbError: string | null = null;
    if (targetStatus === 'Label Generated' && !order.awb) {
      const selectedCourier = courier || order.courier || 'DTDC';
      try {
        const settings = await db.getSettings();
        const courierData = await bookOrderCourierShipment(
          order,
          settings,
          {
            weight: order.weight,
            courier: selectedCourier,
            phone: selectedShipmentContact?.phone || order.phonePrimary,
            shipmentContactType: selectedShipmentContact?.type,
          },
        );

        if (courierData.success) {
          order.awb = courierData.awb;
          order.eta = courierData.eta;
          order.courier = courierData.courier as any;
          if (selectedShipmentContact) {
            order.shipmentContactPhone = selectedShipmentContact.phone;
            order.shipmentContactType = selectedShipmentContact.type;
          }
          order.courierBookingStatus = 'Booked';
          order.courierBookingError = undefined;
          order.courierBookingCompletedAt = new Date().toISOString();
          systemRemarks += ` (Automated: AWB ${courierData.awb} generated via ${selectedCourier} API successfully.)`;
        } else {
          if (courierData.error?.includes('already in progress')) {
            return NextResponse.json({ error: courierData.error }, { status: 409 });
          }
          awbError = courierData.error || 'Unknown Error';
          order.status = previousStatus;
          order.courierBookingStatus = courierData.reconciliationRequired ? 'Reconciliation Required' : 'Failed';
          order.courierBookingError = awbError;
          systemRemarks += ` (Warning: Automated AWB generation failed: ${awbError})`;
        }
      } catch (err: any) {
        console.error('Background courier generation failed:', err);
        awbError = err.message || 'Courier integration API network error.';
        order.status = previousStatus;
        order.courierBookingStatus = 'Reconciliation Required';
        order.courierBookingError = awbError || 'Courier integration API network error.';
        systemRemarks += ` (Warning: Courier integration API network error.)`;
      }
    }

    // B. Record updates in Order History & Audited Temporal Remarks System
    if (remarks && remarks.trim() !== '') {
      if (!order.temporal_remarks) order.temporal_remarks = [];
      order.temporal_remarks.push({
        remark_text: remarks,
        created_at: now,
        author_user_id: session.username
      });
    }

    order.history.push({
      status: order.status,
      timestamp: now,
      updatedBy: session.username,
      remarks: systemRemarks
    });

    // Save order status
    await db.saveOrder(order);

    // C. NDR Trigger
    if (status === 'NDR') {
      const existingNdr = await db.getNdrRecordByOrderId(order.orderId);
      if (!existingNdr) {
        const newNdr: NdrRecord = {
          id: `ndr-${Date.now()}`,
          orderId: order.orderId,
          customerName: order.customerName,
          phonePrimary: order.phonePrimary,
          courier: order.courier || 'DTDC',
          awb: order.awb || 'N/A',
          reason: remarks || 'Delivery failed: Reason code unprovided by courier scan.',
          status: 'Pending',
          createdAt: now,
          updatedAt: now,
          internalNotes: 'Awaiting escalation response from customer.',
          history: [
            {
              action: 'NDR Logged',
              timestamp: now,
              remarks: `NDR logged from status change. Courier reported failed attempt: ${remarks || 'No reason'}`
            }
          ]
        };
        await db.saveNdrRecord(newNdr);
      }
    }

    // D. Trigger Automated WhatsApp messaging for logistics
    if (statusChanged && waTriggerStatuses.includes(targetStatus)) {
      const baseUrl = new URL(request.url).origin;
      // Trigger real WhatsApp in background directly, bypassing loopback network dependencies
      triggerWhatsAppNotification({
        orderId: order.orderId,
        customerName: order.customerName,
        phonePrimary: order.phonePrimary,
        phoneSecondary: order.phoneSecondary,
        phoneTertiary: order.phoneTertiary,
        phoneWhatsApp: order.phoneWhatsApp,
        productName: order.productDetails,
        status: order.status,
        awb: order.awb || 'N/A',
        courier: order.courier || 'N/A',
        eta: order.eta || 'N/A',
        orderValue: order.orderValue,
        paymentType: order.paymentType,
        baseUrl
      }).catch(err => console.error('Failed to trigger background direct WhatsApp:', err));
    }

    return NextResponse.json({ success: true, order, awbError });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update order.' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getActiveSession(request);
    if (!session || !hasAllowedRole(session, ['Super Admin'])) {
      return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();

    const order = await db.getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Update fields
    const {
      customerName,
      phonePrimary,
      phoneSecondary,
      phoneTertiary,
      phoneWhatsApp,
      address,
      pincode,
      state,
      area,
      productDetails,
      paymentType,
      orderValue,
      weight,
      internalRemarks,
      isVip,
      partiallyPaidAmount
    } = body;

    const normalizedWhatsApp = normalizeCustomerWhatsAppNumber(
      phoneWhatsApp !== undefined ? phoneWhatsApp : order.phoneWhatsApp,
    );
    if (!normalizedWhatsApp) {
      return NextResponse.json({ error: 'Enter a valid 10-digit customer WhatsApp number.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const currentPaymentType = paymentType !== undefined ? paymentType : order.paymentType;
    const currentOrderValue = orderValue !== undefined ? parseFloat(orderValue) : order.orderValue;
    const currentPartiallyPaidAmount = partiallyPaidAmount !== undefined ? parseFloat(partiallyPaidAmount) : (order.partiallyPaidAmount || 0);

    if (currentOrderValue <= 0) {
      return NextResponse.json({ error: 'Order value must be greater than 0.' }, { status: 400 });
    }
    if (currentPaymentType === 'Paid') {
      if (currentPartiallyPaidAmount > 0) {
        return NextResponse.json({ error: 'For prepaid (Paid) orders, the partially paid amount must be 0.' }, { status: 400 });
      }
    } else if (currentPaymentType === 'COD') {
      if (currentPartiallyPaidAmount < 0) {
        return NextResponse.json({ error: 'Partially paid amount cannot be negative.' }, { status: 400 });
      }
      if (currentPartiallyPaidAmount >= currentOrderValue) {
        return NextResponse.json({ error: 'For COD orders, the partially paid amount must be less than the total order value.' }, { status: 400 });
      }
    }

    if (customerName !== undefined) order.customerName = customerName;
    if (phonePrimary !== undefined) order.phonePrimary = phonePrimary;
    if (phoneSecondary !== undefined) order.phoneSecondary = phoneSecondary || undefined;
    if (phoneTertiary !== undefined) order.phoneTertiary = phoneTertiary || undefined;
    order.phoneWhatsApp = normalizedWhatsApp;
    if (address !== undefined) order.address = address;
    if (pincode !== undefined) order.pincode = pincode;
    if (state !== undefined) order.state = state;
    if (area !== undefined) order.area = area;
    if (productDetails !== undefined) order.productDetails = productDetails;
    if (paymentType !== undefined) order.paymentType = paymentType;
    if (orderValue !== undefined) {
      order.orderValue = parseFloat(orderValue);
    }
    if (weight !== undefined) order.weight = parseFloat(weight);
    if (internalRemarks !== undefined) order.internalRemarks = internalRemarks || undefined;
    if (isVip !== undefined) order.isVip = !!isVip;
    if (partiallyPaidAmount !== undefined) {
      order.partiallyPaidAmount = parseFloat(partiallyPaidAmount);
    }
    order.finalPayableAmount = order.orderValue - (order.partiallyPaidAmount || 0);

    order.updatedAt = now;

    order.history.push({
      status: order.status,
      timestamp: now,
      updatedBy: session.username,
      remarks: `Order details edited/corrected by admin.`
    });

    await db.saveOrder(order);
    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update order.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getActiveSession(request);
    if (!session || !hasAllowedRole(session, ['Super Admin', 'Order Team'])) {
      return NextResponse.json({ error: 'Order Team access required.' }, { status: 403 });
    }
    const { id } = await params;

    const order = await db.getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Role Permission Checks
    if (session.role === 'Order Team' && order.status !== 'Created') {
      return NextResponse.json({ error: `Order Team can only delete orders in Created status.` }, { status: 403 });
    }

    // Execute Soft Delete
    const now = new Date().toISOString();
    order.isDeleted = true;
    order.deletedAt = now;
    order.deletedBy = session.username;
    order.history.push({
      status: order.status,
      timestamp: now,
      updatedBy: session.username,
      remarks: `Order marked as deleted by ${session.username} (${session.role}).`
    });

    await db.saveOrder(order);
    return NextResponse.json({ success: true, message: `Order ${order.orderId} deleted successfully.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete order.' }, { status: 500 });
  }
}
