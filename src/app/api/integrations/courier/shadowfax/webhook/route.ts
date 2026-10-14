import { syncOrderStatus } from '@/lib/courierSync';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { OrderStatus } from '@/lib/types';
import { verifyWebhookSignature } from '@/lib/webhookSecurity';

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
    const rawBody = await request.text();
    if (!verifyWebhookSignature(rawBody, request.headers, process.env.SHADOWFAX_WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    }
    const payload = JSON.parse(rawBody);

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
      if (newStatus && order.awb) {
        const result = await syncOrderStatus(order.awb, newStatus, payload.location, comments, undefined, payload.timestamp || payload.created || payload.event_time);
        if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }

    }

    return NextResponse.json({ success: true, message: 'Callback processed successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Callback error' }, { status: 500 });
  }
}
