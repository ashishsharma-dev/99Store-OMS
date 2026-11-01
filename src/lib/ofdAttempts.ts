import type { Order } from './types';

type OrderHistory = Order['history'];

/** Count actual transitions into OFD, ignoring note-only history rows. */
export function countOfdAttempts(history: OrderHistory | undefined): number {
  if (!history?.length) return 0;

  let attempts = 0;
  let previousStatus: string | undefined;
  for (const entry of history) {
    if (entry.status === 'OFD' && previousStatus !== 'OFD') attempts += 1;
    previousStatus = entry.status;
  }
  return attempts;
}
