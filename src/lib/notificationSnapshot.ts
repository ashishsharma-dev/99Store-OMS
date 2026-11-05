import { db } from '@/lib/db';
import type { NdrRecord, Order } from '@/lib/types';

export async function loadNotificationSnapshot(): Promise<{ orders: Order[]; ndrRecords: NdrRecord[] }> {
  const [orderResult, ndrRecords] = await Promise.all([
    db.queryOrders({ page: 1, limit: 50, sortField: 'updatedAt', sortOrder: 'desc' }),
    db.getNdrRecords(),
  ]);

  return {
    orders: orderResult.items,
    ndrRecords: [...ndrRecords].sort((left, right) =>
      String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt))
    ),
  };
}
