import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncOrderStatus } from '@/lib/courierSync';

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const awb = payload.awb_number || payload.awb || payload.waybill;
    const orderId = payload.order_id || payload.orderId;
    const courierStatus = payload.status || payload.event || 'In Transit';
    const scanLocation = payload.current_location || payload.location || 'Hub';
    const comments = payload.comments || payload.description || '';
    const riderContact = payload.rider_contact || payload.riderPhone;
    const riderName = payload.rider_name || payload.riderName;

    // Log the incoming Shadowfax Webhook event
    await db.addCourierLog({
      id: `cl-sfx-webhook-${Date.now()}`,
      timestamp: new Date().toISOString(),
      courier: 'Shadowfax',
      action: 'Webhook Callback',
      requestPayload: JSON.stringify(payload, null, 2),
      responsePayload: JSON.stringify({ received: true }, null, 2),
      status: 'Success'
    });

    if (!awb && !orderId) {
      return NextResponse.json({ error: 'Missing awb_number or order_id in payload.' }, { status: 400 });
    }

    // Resolve order
    const orders = await db.getOrders();
    const order = orders.find(
      o =>
        (awb && o.awb && o.awb.toLowerCase() === String(awb).toLowerCase()) ||
        (orderId && o.orderId.toLowerCase() === String(orderId).toLowerCase())
    );

    if (order) {
      // If rider contact is provided, record it as Field Executive (FE) number
      if (riderContact) {
        order.feNumber = String(riderContact);
        await db.saveOrder(order);
      }

      const waybillToSync = order.awb || String(awb);
      const customRemarks = riderName 
        ? `${comments} (Rider: ${riderName}${riderContact ? `, Phone: ${riderContact}` : ''})` 
        : comments;

      const result = await syncOrderStatus(
        waybillToSync,
        String(courierStatus),
        scanLocation,
        customRemarks
      );

      return NextResponse.json({
        success: true,
        updated: result.updated,
        orderId: order.orderId,
        status: order.status
      });
    }

    return NextResponse.json({ success: true, message: 'Order not found, logged webhook event.' });
  } catch (error: any) {
    console.error('Shadowfax webhook processing error:', error);
    return NextResponse.json({ error: error.message || 'Webhook processing failed.' }, { status: 500 });
  }
}
