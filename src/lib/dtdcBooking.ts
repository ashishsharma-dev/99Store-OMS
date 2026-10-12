import { createHash } from 'node:crypto';
import type { Order } from './types';

/** DTDC deduplicates customer references. Display IDs can be reused after deletion.
 * Include immutable creation identity, but never attempt IDs or mutable order data:
 * retries must reuse the same reference rather than create another consignment.
 */
export function dtdcCustomerReference(order: Pick<Order, 'id' | 'orderId' | 'createdAt'>): string {
  if (!order.id || !order.orderId || !order.createdAt || !Number.isFinite(Date.parse(order.createdAt))) {
    throw new Error('DTDC booking requires an order ID and valid creation timestamp.');
  }
  const identity = JSON.stringify([order.id, order.orderId, new Date(order.createdAt).toISOString()]);
  return `OMS-${createHash('sha256').update(identity).digest('hex').slice(0, 24).toUpperCase()}`;
}
