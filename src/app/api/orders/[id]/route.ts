import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Order, OrderStatus, NdrRecord } from '@/lib/types';
import { triggerWhatsAppNotification } from '@/lib/whatsapp';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await db.getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch order.' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      status, 
      remarks, 
      updatedBy, 
      courier, 
      awb, 
      eta,
      partiallyPaidAmount,
      feNumber,
      assignedTo,
      inNdrWorkingSheet,
      ndrAction,
      futureDeliveryDate,
      isVip
    } = body;

    if (!updatedBy) {
      return NextResponse.json({ error: 'updatedBy is a required field.' }, { status: 400 });
    }

    const order = await db.getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const previousStatus = order.status;
    const now = new Date().toISOString();
    const targetStatus = status || previousStatus;

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
        const courierRes = await fetch(`${baseUrl}/api/integrations/courier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.orderId,
            courier: selectedCourier,
            weight: order.weight,
            paymentType: order.paymentType,
            codAmount: order.orderValue - (order.partiallyPaidAmount || 0),
            customerName: order.customerName,
            pincode: order.pincode
          })
        });
        const courierData = await courierRes.json();

        if (courierRes.ok && courierData.success) {
          order.awb = courierData.awb;
          order.eta = courierData.eta;
          order.courier = courierData.courier;
          systemRemarks += ` (Automated: AWB ${courierData.awb} generated via ${selectedCourier} API successfully.)`;
        } else {
          awbError = courierData.error || 'Unknown Error';
          systemRemarks += ` (Warning: Automated AWB generation failed: ${awbError})`;
        }
      } catch (err: any) {
        console.error('Background courier generation failed:', err);
        awbError = err.message || 'Courier integration API network error.';
        systemRemarks += ` (Warning: Courier integration API network error.)`;
      }
    }

    // B. Record updates in Order History & Audited Temporal Remarks System
    if (remarks && remarks.trim() !== '') {
      if (!order.temporal_remarks) order.temporal_remarks = [];
      order.temporal_remarks.push({
        remark_text: remarks,
        created_at: now,
        author_user_id: updatedBy || 'system'
      });
    }

    order.history.push({
      status: order.status,
      timestamp: now,
      updatedBy,
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
    const waTriggerStatuses = ['Label Generated', 'Dispatched', 'OFD', 'Delivered', 'NDR', 'Return'];
    if (status && waTriggerStatuses.includes(status)) {
      const baseUrl = new URL(request.url).origin;
      // Trigger real WhatsApp in background directly, bypassing loopback network dependencies
      triggerWhatsAppNotification({
        orderId: order.orderId,
        customerName: order.customerName,
        phonePrimary: order.phonePrimary,
        phoneSecondary: order.phoneSecondary,
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
    const { id } = await params;
    const body = await request.json();
    
    // Check permission - must be Admin
    const userRole = request.headers.get('x-user-role') || body.role || '';
    const isAdmin = userRole === 'Super Admin' || userRole === 'Admin' || userRole.toLowerCase().includes('admin');
    
    if (!isAdmin) {
      return NextResponse.json({ error: '403 Forbidden: Only Admin role can edit orders.' }, { status: 403 });
    }

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
      partiallyPaidAmount,
      updatedBy
    } = body;

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
    if (phoneWhatsApp !== undefined) order.phoneWhatsApp = phoneWhatsApp || undefined;
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
      updatedBy: updatedBy || 'admin',
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
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const deletedBy = searchParams.get('deletedBy') || 'user';
    const userRole = searchParams.get('role') || '';

    const order = await db.getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Role Permission Checks
    if (userRole !== 'Super Admin' && userRole !== 'Order Team') {
      return NextResponse.json({ error: `Role '${userRole}' is not authorized to delete orders.` }, { status: 403 });
    }

    if (userRole === 'Order Team' && order.status !== 'Created') {
      return NextResponse.json({ error: `Order Team can only delete orders in Created status.` }, { status: 403 });
    }

    // Execute Soft Delete
    const now = new Date().toISOString();
    order.isDeleted = true;
    order.deletedAt = now;
    order.deletedBy = deletedBy;
    order.history.push({
      status: order.status,
      timestamp: now,
      updatedBy: deletedBy,
      remarks: `Order marked as deleted by ${deletedBy} (${userRole}).`
    });

    await db.saveOrder(order);
    return NextResponse.json({ success: true, message: `Order ${order.orderId} deleted successfully.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete order.' }, { status: 500 });
  }
}
