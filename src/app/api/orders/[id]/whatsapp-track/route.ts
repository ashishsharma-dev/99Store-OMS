import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { triggerWhatsAppNotification } from '@/lib/whatsapp';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await db.getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Try parsing body for specific targetNumbers selection and template/status override
    let targetNumbers: string[] | undefined = undefined;
    let targetStatus = order.status;
    try {
      const body = await request.json();
      if (body) {
        if (body.template) {
          targetStatus = body.template;
        } else if (body.status) {
          targetStatus = body.status;
        }
        if (Array.isArray(body.targetNumbers)) {
          targetNumbers = body.targetNumbers;
        }
      }
    } catch (e) {
      // Body might be empty, ignore
    }

    // Server-side check for 1-minute rate limit between consecutive messages for the same orderId
    const allLogs = await db.getWhatsAppLogs();
    const lastSent = allLogs.find(l => 
      l.orderId === order.orderId && 
      (l.status === 'Sent' || l.status === 'Pending') &&
      Date.now() - new Date(l.timestamp).getTime() < 60000
    );
    if (lastSent) {
      return NextResponse.json(
        { error: 'Rate limit exceeded: A message was already sent or queued for this parcel in the last 1 minute.' },
        { status: 429 }
      );
    }

    // Trigger WhatsApp notification for selected status & tracking details
    const baseUrl = new URL(request.url).origin;
    const logs = await triggerWhatsAppNotification({
      orderId: order.orderId,
      customerName: order.customerName,
      phonePrimary: order.phonePrimary,
      phoneSecondary: order.phoneSecondary,
      status: targetStatus,
      awb: order.awb || 'PENDING',
      courier: order.courier || 'N/A',
      eta: order.eta || '3-4 Days',
      orderValue: order.orderValue,
      paymentType: order.paymentType,
      baseUrl,
      targetNumbers,
      isOnDemand: true
    });

    return NextResponse.json({
      success: true,
      message: 'On-demand WhatsApp tracking notification sent successfully.',
      logs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to send WhatsApp tracking update.' },
      { status: 500 }
    );
  }
}
