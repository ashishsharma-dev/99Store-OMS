export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production' && process.env.COURIER_TRACKING_POLL_ENABLED === 'true' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { startTrackingScheduler } = await import('./lib/trackingScheduler');
    startTrackingScheduler();
  }
}
