export function isCourierSimulationEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_COURIER_SIMULATION === 'true';
}
