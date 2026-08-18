import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

// Global set to track AWBs currently undergoing synchronization to prevent duplicate requests
const inFlightSyncAwbs = new Set<string>();

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const runInBackground = searchParams.get('background') === 'true';

    const baseUrl = new URL(request.url).origin;
    const orders = await db.getOrders();

    // Active orders requiring tracking sync (dispatched, out for delivery, in transit, NDR, etc.)
    const activeOrders = orders.filter(o => 
      !o.isDeleted && 
      !o.cancelled &&
      o.awb && 
      o.awb.trim() !== '' &&
      o.status !== 'Delivered' && 
      o.status !== 'Return'
    );

    if (activeOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active package shipments require tracking synchronization.',
        totalChecked: 0,
        totalUpdated: 0,
        updates: []
      });
    }

    const batchSize = parseInt(process.env.COURIER_SYNC_BATCH_SIZE || '5', 10);

    // Helper function to sync a single order safely with deduplication and retry
    const syncSingleOrder = async (order: typeof activeOrders[0]) => {
      const awb = order.awb!;
      if (inFlightSyncAwbs.has(awb)) {
        console.log(`[Courier Sync] AWB ${awb} is already currently synchronizing. Skipping duplicate task.`);
        return null;
      }

      inFlightSyncAwbs.add(awb);
      const previousStatus = order.status;

      try {
        const courierParam = order.courier ? `&courier=${encodeURIComponent(order.courier)}` : '';
        const url = `${baseUrl}/api/integrations/courier?action=track&waybill=${encodeURIComponent(awb)}${courierParam}`;

        await fetchWithRetry(
          url,
          { method: 'GET' },
          {
            awb,
            courierName: order.courier || 'Courier',
            timeoutMs: 10000,
            maxAttempts: 3,
            validateStatus: true
          }
        );

        // Re-fetch order to check if status was updated as a side-effect
        const updatedOrder = await db.getOrderById(order.id);
        if (updatedOrder && updatedOrder.status !== previousStatus) {
          return {
            orderId: order.orderId,
            awb,
            previousStatus,
            newStatus: updatedOrder.status
          };
        }
      } catch (err: any) {
        console.error(`[Courier Sync Error] Failed background sync for AWB ${awb} (Order ${order.orderId}):`, err.message || err);
      } finally {
        inFlightSyncAwbs.delete(awb);
      }

      return null;
    };

    if (runInBackground) {
      // Execute background processing in non-blocking batches
      (async () => {
        for (let i = 0; i < activeOrders.length; i += batchSize) {
          const batch = activeOrders.slice(i, i + batchSize);
          await Promise.allSettled(batch.map(order => syncSingleOrder(order)));
          // Yield to event loop to keep server responsive
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      })().catch(err => console.error('[Courier Sync Fatal] Background bulk sync runner error:', err));

      return NextResponse.json({
        success: true,
        message: `Bulk tracking synchronization started in the background for ${activeOrders.length} packages.`,
        totalChecked: activeOrders.length,
        totalUpdated: 0,
        updates: []
      });
    }

    // Synchronous execution for manual triggers
    const updates: { orderId: string; awb: string; previousStatus: string; newStatus: string }[] = [];

    for (let i = 0; i < activeOrders.length; i += batchSize) {
      const batch = activeOrders.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(order => syncSingleOrder(order)));

      for (const res of results) {
        if (res.status === 'fulfilled' && res.value) {
          updates.push(res.value);
        }
      }

      // Yield to event loop
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized tracking feeds. Checked ${activeOrders.length} packages, updated ${updates.length} statuses.`,
      totalChecked: activeOrders.length,
      totalUpdated: updates.length,
      updates
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bulk tracking synchronization failed.' }, { status: 500 });
  }
}
