import { NextResponse } from 'next/server';
import { triggerWhatsAppNotification } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      orderId, 
      customerName, 
      phonePrimary, 
      phoneSecondary, 
      status, 
      awb, 
      courier, 
      eta, 
      orderValue, 
      paymentType 
    } = body;

    if (!orderId || !customerName || !phonePrimary || !status) {
      return NextResponse.json({ error: 'Missing required parameters (orderId, customerName, phonePrimary, status)' }, { status: 400 });
    }

    const logs = await triggerWhatsAppNotification({
      orderId,
      customerName,
      phonePrimary,
      phoneSecondary,
      status,
      awb,
      courier,
      eta,
      orderValue,
      paymentType
    });

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'WhatsApp API Integration failed.' }, { status: 500 });
  }
}
