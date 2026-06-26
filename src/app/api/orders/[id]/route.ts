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
      futureDeliveryDate
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
    if (awb) order.awb = awb;
    if (eta) order.eta = eta;

    // Additional requirement fields
    if (partiallyPaidAmount !== undefined) {
      order.partiallyPaidAmount = parseFloat(partiallyPaidAmount);
      order.finalPayableAmount = order.orderValue - order.partiallyPaidAmount;
    }
    if (feNumber !== undefined) order.feNumber = feNumber;
    if (inNdrWorkingSheet !== undefined) order.inNdrWorkingSheet = !!inNdrWorkingSheet;
    if (ndrAction !== undefined) order.ndrAction = ndrAction;
    if (futureDeliveryDate !== undefined) order.futureDeliveryDate = futureDeliveryDate;

    // 2. Perform automated workflow integrations based on status changes
    let systemRemarks = remarks || `Status transitioned from ${previousStatus} to ${targetStatus}.`;

    if (assignedTo !== undefined && assignedTo !== order.assignedTo) {
      const prevAssignee = order.assignedTo || 'Unassigned';
      order.assignedTo = assignedTo;
      systemRemarks = remarks || `Order reassigned from ${prevAssignee} to ${assignedTo || 'Unassigned'}.`;
    }

    const baseUrl = new URL(request.url).origin;

    // A. PACKING queue -> Trigger Auto AWB generation if not yet allocated
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
            codAmount: order.orderValue,
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
          systemRemarks += ` (Warning: Automated AWB generation failed: ${courierData.error || 'Unknown Error'})`;
        }
      } catch (err: any) {
        console.error('Background courier generation failed:', err);
        systemRemarks += ` (Warning: Courier integration API network error.)`;
      }
    }

    // B. Record updates in Order History
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
    const waTriggerStatuses = ['Dispatched', 'OFD', 'Delivered', 'NDR', 'Return'];
    if (status && waTriggerStatuses.includes(status)) {
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
        paymentType: order.paymentType
      }).catch(err => console.error('Failed to trigger background direct WhatsApp:', err));
    }

    return NextResponse.json({ success: true, order });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update order.' }, { status: 500 });
  }
}
