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

    // Try parsing body for specific targetNumbers selection
    let targetNumbers: string[] | undefined = undefined;
    try {
      const body = await request.json();
      if (body && Array.isArray(body.targetNumbers)) {
        targetNumbers = body.targetNumbers;
      }
    } catch (e) {
      // Body might be empty, ignore
    }

    // Trigger WhatsApp notification for current status & tracking details
    const baseUrl = new URL(request.url).origin;
    const logs = await triggerWhatsAppNotification({
      orderId: order.orderId,
      customerName: order.customerName,
      phonePrimary: order.phonePrimary,
      phoneSecondary: order.phoneSecondary,
      status: order.status,
      awb: order.awb || 'PENDING',
      courier: order.courier || 'N/A',
      eta: order.eta || '3-4 Days',
      orderValue: order.orderValue,
      paymentType: order.paymentType,
      baseUrl,
      targetNumbers,
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
