import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Order } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim() || '';

    if (!id) {
      return NextResponse.json({ error: 'Tracking ID is required.' }, { status: 400 });
    }

    const orders = await db.getOrders();
    const order = orders.find(o => 
      !o.isDeleted && 
      (o.orderId.toLowerCase() === id.toLowerCase() || 
       (o.awb && o.awb.toLowerCase() === id.toLowerCase()))
    );

    if (!order) {
      return NextResponse.json({ error: 'No shipment found for the provided ID.' }, { status: 404 });
    }

    // Return only public-facing tracking details (hide internal notes, order values, etc.)
    return NextResponse.json({
      success: true,
      order: {
        orderId: order.orderId,
        customerName: order.customerName,
        status: order.status,
        courier: order.courier,
        awb: order.awb,
        eta: order.eta,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        history: order.history
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch tracking details.' }, { status: 500 });
  }
}
