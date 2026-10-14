import { db } from './db';
import { handleCourierTracking } from './courierTrackingHandler';
type SyncResult = { totalChecked: number; totalUpdated: number; failed: number };
const shared = globalThis as typeof globalThis & { courierSyncRun?: Promise<SyncResult> };
export function syncActiveShipments() {
  if (shared.courierSyncRun) return shared.courierSyncRun;
  shared.courierSyncRun = (async () => {
    const orders = (await db.getOrders()).filter(o => !o.isDeleted && !o.cancelled && o.awb && o.awb !== 'PENDING' && !['Delivered', 'Return'].includes(o.status));
    let totalUpdated = 0;
    let failed = 0;
    const configured = Number(process.env.COURIER_SYNC_BATCH_SIZE || 5);
    const batchSize = Number.isFinite(configured) ? Math.max(1, Math.min(10, Math.floor(configured))) : 5;
    for (let i = 0; i < orders.length; i += batchSize) {
      await Promise.all(orders.slice(i, i + batchSize).map(async order => {
        try {
          const previousStatus = order.status;
          const query = new URLSearchParams({ action: 'track', waybill: order.awb!, courier: order.courier || '' });
          const response = await handleCourierTracking(new Request(`http://localhost/api/integrations/courier?${query}`));
          if (!response.ok) { failed++; return; }
          const updated = await db.getOrderById(order.id);
          if (updated && updated.status !== previousStatus) totalUpdated++;
        } catch (error) { failed++; console.error('[Tracking scheduler]', order.orderId, error); }
      }));
    }
    return { totalChecked: orders.length, totalUpdated, failed };
  })().finally(() => { shared.courierSyncRun = undefined; });
  return shared.courierSyncRun;
}
/** Reconcile on the single-instance PM2 server even when the dashboard is closed. */
export function startTrackingScheduler() {
  const state = globalThis as typeof globalThis & { courierTrackingTimer?: ReturnType<typeof setTimeout> };
  if (state.courierTrackingTimer) return;
  const tick = async () => {
    try { await syncActiveShipments(); }
    catch (error) { console.error('[Tracking scheduler]', error); }
    finally { state.courierTrackingTimer = setTimeout(tick, 60_000); state.courierTrackingTimer.unref(); }
  };
  state.courierTrackingTimer = setTimeout(tick, 10_000);
  state.courierTrackingTimer.unref();
}
