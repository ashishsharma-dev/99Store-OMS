export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production' || process.env.NEXT_PHASE === 'phase-production-build') return;

  if (process.env.COURIER_TRACKING_POLL_ENABLED === 'true') {
    const { startTrackingScheduler } = await import('./lib/trackingScheduler');
    startTrackingScheduler();
  }

  if (process.env.WHATSAPP_RECONCILIATION_ENABLED !== 'false') {
    const { startWhatsAppReconciliationScheduler } = await import('./lib/whatsappReconciliation');
    startWhatsAppReconciliationScheduler();
  }
}
