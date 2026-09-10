import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { OrderStatus } from '@/lib/types';

function mapShadowfaxEventToOrderStatus(event: string, statusDisplay?: string): OrderStatus | null {
  const evt = (event || statusDisplay || '').toLowerCase();

  if (evt === 'delivered') return 'Delivered';
  if (evt === 'ofd' || evt.includes('out for delivery')) return 'OFD';
  if (evt.includes('picked') || evt.includes('received')) return 'Dispatched';
  if (evt.includes('rts') || evt.includes('rto')) return 'Return';
  if (evt === 'nc' || evt === 'na' || evt.includes('not contactable') || evt.includes('not attempted')) return 'NDR';
  if (evt.includes('cancelled')) return 'Undelivered';

  return null;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    await db.addCourierLog({
      id: `cl-sfx-webhook-${Date.now()}`,
      timestamp: new Date().toISOString(),
      courier: 'Shadowfax',
      action: 'Push Callback Webhook',
      requestPayload: JSON.stringify(payload, null, 2),
      responsePayload: JSON.stringify({ status: 'ACKNOWLEDGED' }),
      status: 'Success'
    });

    const awb = payload.awb_number;
    const clientOrderId = payload.order_id;
    const event = payload.event || payload.status;
    const comments = payload.comments || `Shadowfax status updated: ${payload.status || event}`;

    if (!clientOrderId && !awb) {
      return NextResponse.json({ success: false, error: 'Missing order_id or awb_number' }, { status: 400 });
    }

    const orders = await db.getOrders();
    const order = orders.find(o => 
      (clientOrderId && o.orderId === clientOrderId) || 
      (awb && o.awb === awb)
    );

    if (order) {
      const newStatus = mapShadowfaxEventToOrderStatus(event, payload.status);
      const updatedHistory = [...(order.history || []), {
        status: newStatus || order.status,
        timestamp: new Date().toISOString(),
        updatedBy: 'Shadowfax Webhook',
        remarks: comments
      }];

      const updatedOrder = {
        ...order,
        status: newStatus || order.status,
        current_status: payload.status || event,
        last_tracking_update: new Date().toISOString(),
        history: updatedHistory,
        updatedAt: new Date().toISOString()
      };

      await db.saveOrder(updatedOrder);

      // Handle NDR auto-logging if non-delivery event occurs
      if (newStatus === 'NDR') {
        const ndrRecords = await db.getNdrRecords();
        const existingNdr = ndrRecords.find(n => n.orderId === order.orderId || n.awb === awb);
        if (!existingNdr) {
          await db.saveNdrRecord({
            id: `ndr-${Date.now()}`,
            orderId: order.orderId,
            customerName: order.customerName,
            phonePrimary: order.phonePrimary,
            courier: 'Shadowfax',
            awb: awb || order.awb || '',
            reason: comments || 'Customer Undelivered / Not Contactable',
            status: 'Pending',
            internalNotes: 'Auto-created via Shadowfax Callback Webhook',
            history: [{
              action: 'NDR Reported',
              timestamp: new Date().toISOString(),
              remarks: comments
            }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Callback processed successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Callback error' }, { status: 500 });
  }
}
