import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const runInBackground = searchParams.get('background') === 'true';

    const baseUrl = new URL(request.url).origin;
    const orders = await db.getOrders();

    // Active shipments that are shipped but not yet finalized (Delivered, RDC, or cancelled)
    const activeStates = ['Label Generated', 'Dispatched', 'OFD', 'NDR', 'Return'];
    const activeOrders = orders.filter(o => o.awb && activeStates.includes(o.status));

    if (activeOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active shipments found to synchronize.',
        totalChecked: 0,
        totalUpdated: 0,
        updates: []
      });
    }

    if (runInBackground) {
      // Execute sequentially in the background to prevent db write race conditions
      (async () => {
        for (const order of activeOrders) {
          const courierParam = order.courier ? `&courier=${order.courier}` : '';
          try {
            const url = `${baseUrl}/api/integrations/courier?action=track&waybill=${encodeURIComponent(order.awb!)}${courierParam}`;
            await fetch(url);
          } catch (err) {
            console.error(`Failed background sync for AWB ${order.awb}:`, err);
          }
        }
      })().catch(err => console.error('Background bulk sync process error:', err));

      return NextResponse.json({
        success: true,
        message: `Bulk tracking synchronization started in the background for ${activeOrders.length} packages.`
      });
    }

    // Synchronous execution for manual requests
    const updates: { orderId: string; awb: string; previousStatus: string; newStatus: string }[] = [];
    let totalUpdated = 0;

    for (const order of activeOrders) {
      const courierParam = order.courier ? `&courier=${order.courier}` : '';
      const previousStatus = order.status;

      try {
        const url = `${baseUrl}/api/integrations/courier?action=track&waybill=${encodeURIComponent(order.awb!)}${courierParam}`;
        const response = await fetch(url);
        
        if (response.ok) {
          // Re-fetch order from database to see if status updated via tracking GET side-effect
          const updatedOrder = await db.getOrderById(order.id);
          if (updatedOrder && updatedOrder.status !== previousStatus) {
            totalUpdated++;
            updates.push({
              orderId: order.orderId,
              awb: order.awb!,
              previousStatus,
              newStatus: updatedOrder.status
            });
          }
        }
      } catch (err) {
        console.error(`Failed to sync waybill ${order.awb} for order ${order.orderId}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized tracking feeds. Checked ${activeOrders.length} packages, updated ${totalUpdated} statuses.`,
      totalChecked: activeOrders.length,
      totalUpdated,
      updates
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bulk synchronization failed.' }, { status: 500 });
  }
}
