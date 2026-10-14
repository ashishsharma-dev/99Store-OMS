import { normalizeCourierEventTime } from '@/lib/courierEventTime';
import { db } from '@/lib/db';
import { Order, OrderStatus, NdrRecord } from '@/lib/types';
import { triggerWhatsAppNotification } from '@/lib/whatsapp';

/**
 * Maps live courier API status strings to internal 99Store OrderStatus types.
 */
export function mapCourierStatusToInternal(courierStatus: any): OrderStatus | null {
  if (!courierStatus) return null;
  const statusStr = typeof courierStatus === 'string' 
    ? courierStatus 
    : typeof courierStatus === 'object' 
      ? JSON.stringify(courierStatus) 
      : String(courierStatus);
      
  const status = statusStr.toLowerCase().trim();

  if (status === 'rdc' || status.includes('returned to delivery center') || status.includes('returned to warehouse') || status.includes('returned to hub')) return 'RDC';
  if (status === 'nc' || status === 'na' || status.includes('not contactable') || status.includes('not attempted')) return 'NDR';
  if (status === 'picked' || status === 'picked up' || status === 'received') return 'Dispatched';
  if (status === 'rts') return 'Return';

  if (
    status === 'delivered' || 
    status.includes('delivered successfully') || 
    status.includes('successful delivery') || 
    status === 'completed'
  ) {
    return 'Delivered';
  }

  if (
    status === 'out for delivery' || 
    status === 'ofd' || 
    status.includes('out_for_delivery') || 
    status.includes('pending delivery') || 
    status.includes('out with courier') ||
    status.includes('out_with_courier') ||
    status.includes('with courier')
  ) {
    return 'OFD';
  }

  if (
    status.includes('call placed') ||
    status.includes('call_placed') ||
    status.includes('consignee contacted') ||
    status.includes('customer contacted') ||
    status.includes('pre-delivery call') ||
    status.includes('pre_delivery_call') ||
    status.includes('call to customer') ||
    status.includes('customer called') ||
    status === 'call_placed_notification'
  ) {
    return 'Call Placed Notification';
  }

  if (
    status === 'in transit' ||
    status === 'dispatched' ||
    status === 'shipped' ||
    status === 'transit' ||
    status.includes('manifest uploaded') ||
    status === 'manifested' ||
    status.includes('data received') ||
    status.includes('in_transit') ||
    status.includes('departed') ||
    status === 'in-transit'
  ) {
    return 'Dispatched';
  }

  if (
    status === 'ndr' || 
    status.includes('failed') || 
    status.includes('exception') || 
    status.includes('undelivered') || 
    status.includes('non-delivered') || 
    status.includes('non_delivered') || 
    status.includes('refused') || 
    status.includes('rejected') || 
    status.includes('unreachable') || 
    status.includes('delayed') ||
    status.includes('awaiting instruction') ||
    status.includes('attempts reached') ||
    status.includes('attempts_reached') ||
    status.includes('not available') ||
    status.includes('unavailable') ||
    status.includes('denied')
  ) {
    return 'NDR';
  }

  if (
    status.includes('return to origin') || 
    status.includes('rto') || 
    status.includes('returned') || 
    status.includes('returning') || 
    status.includes('return')
  ) {
    return 'Return';
  }

  return null;
}

/**
 * Synchronizes an order's status with a live courier status, 
 * triggering db saves, order history records, WhatsApp alerts, and NDR logging.
 */
async function applyOrderStatus(
  waybill: string,
  courierStatus: string,
  scanLocation?: string,
  customRemarks?: string,
  eta?: string,
  eventTimestamp?: string
): Promise<{ updated: boolean; order?: Order; error?: string }> {
  try {
    const orders = await db.getOrders();
    const order = orders.find(
      o =>
        (o.awb && o.awb.trim().toLowerCase() === waybill.trim().toLowerCase()) ||
        (o.dtdc_reference_number && o.dtdc_reference_number.trim().toLowerCase() === waybill.trim().toLowerCase())
    );

    if (!order) {
      return { updated: false, error: `Order with AWB ${waybill} not found.` };
    }

    let mappedStatus = mapCourierStatusToInternal(courierStatus);

    const now = new Date().toISOString();
    const locStr = scanLocation ? ` [Hub: ${scanLocation}]` : '';
    const sysRemarks = customRemarks || `Auto-synced status from ${order.courier} tracking API. Courier Status: "${courierStatus}"${locStr}.`;

    // Override or refine mapped status based on remarks/instructions context
    if (sysRemarks) {
      const remarksLower = sysRemarks.toLowerCase();
      // 1. Delhivery reports its ST-114 call event in Instructions while the
      // top-level shipment status remains "Dispatched".
      if (remarksLower.includes('call placed')) {
        if (mappedStatus !== 'Delivered' && mappedStatus !== 'Return' && mappedStatus !== 'RDC') {
          mappedStatus = 'Call Placed Notification';
        }
      }
      // 2. Check for Out for Delivery override
      if (remarksLower.includes('out for delivery') || remarksLower.includes('out_for_delivery') || remarksLower.includes('ofd') || remarksLower.includes('out with courier') || remarksLower.includes('pending delivery')) {
        if (mappedStatus !== 'Delivered' && mappedStatus !== 'Return' && mappedStatus !== 'RDC') {
          mappedStatus = 'OFD';
        }
      }
      // 3. Check for Return override
      if (mappedStatus !== 'Delivered' && mappedStatus !== 'RDC' && (remarksLower.includes('return to origin') || remarksLower.includes('rto') || remarksLower.includes('returned') || remarksLower.includes('type: rt') || remarksLower.includes('status: rt'))) {
        mappedStatus = 'Return';
      }
      // 4. Check for NDR override
      if (remarksLower.includes('consignee unavailable') || remarksLower.includes('unavailable') || remarksLower.includes('failed attempt') || remarksLower.includes('not available') || remarksLower.includes('undelivered') || remarksLower.includes('refused') || remarksLower.includes('rejected') || remarksLower.includes('unreachable') || remarksLower.includes('delayed') || remarksLower.includes('no such') || remarksLower.includes('incorrect address')) {
        if (mappedStatus !== 'Delivered' && mappedStatus !== 'Return' && mappedStatus !== 'RDC') {
          mappedStatus = 'NDR';
        }
      }
    }

    if (!mappedStatus) {
      return { updated: false, error: `Unable to map courier status: "${courierStatus}"` };
    }

    const eventTime = normalizeCourierEventTime(eventTimestamp);
    const previousTime = order.lastCourierEventAt;
    if (eventTime && order.status !== mappedStatus && order.history.some(item => item.status === mappedStatus && item.timestamp === eventTime)) {
      return { updated: false, order };
    }
    if (eventTime && previousTime && Date.parse(eventTime) < Date.parse(previousTime)) {
      return { updated: false, order };
    }
    if (!eventTime && mappedStatus === 'Dispatched' && ['OFD', 'NDR', 'Call Placed Notification', 'RDC'].includes(order.status)) return { updated: false, order };
    // A late or undated feed must not reopen a completed shipment.
    if (order.status === 'Delivered' && mappedStatus !== 'Delivered') return { updated: false, order };
    if (order.status === 'Return' && !['Return', 'RDC'].includes(mappedStatus)) return { updated: false, order };
    const statusChanged = order.status !== mappedStatus;
    let hasChanges = false;
    if (eventTime && eventTime !== previousTime) {
      order.lastCourierEventAt = eventTime;
      hasChanges = true;
    }
    order.last_tracking_update = now;


    // Parse Field Executive (FE) number if it's OFD or Call Placed
    if (mappedStatus === 'OFD' || mappedStatus === 'Call Placed Notification') {
      const searchString = `${sysRemarks} ${courierStatus}`.toLowerCase();
      const match = searchString.match(/\b([6-9]\d{9})\b/);
      if (match) {
        const feNum = match[1];
        if (order.feNumber !== feNum) {
          order.feNumber = feNum;
          hasChanges = true;
        }
      }
    }

    // 1. Update Order Status
    if (statusChanged) {
      order.status = mappedStatus;
      order.updatedAt = now;
      order.history.push({
        status: mappedStatus,
        timestamp: eventTime || now,
        updatedBy: 'courier_api_sync',
        remarks: sysRemarks
      });
      hasChanges = true;
    }

    // 2. Update Live ETA if provided
    if (eta) {
      const cleanEta = eta.split(' ')[0].split('T')[0];
      if (cleanEta && cleanEta.length >= 8 && order.eta !== cleanEta) {
        order.eta = cleanEta;
        order.updatedAt = now;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await db.saveOrder(order);
    } else {
      return { updated: false, order };
    }

    // 4. NDR Side Effect Trigger
    if (mappedStatus === 'NDR') {
      const existingNdr = await db.getNdrRecordByOrderId(order.orderId);
      if (!existingNdr) {
        const newNdr: NdrRecord = {
          id: `ndr-${Date.now()}`,
          orderId: order.orderId,
          customerName: order.customerName,
          phonePrimary: order.phonePrimary,
          courier: order.courier || 'DTDC',
          awb: order.awb || 'N/A',
          reason: customRemarks || `Courier reported exception: "${courierStatus}" at ${scanLocation || 'Hub'}.`,
          status: 'Pending',
          createdAt: now,
          updatedAt: now,
          internalNotes: 'Awaiting escalation response from customer (Auto-Logged via Courier Sync).',
          history: [
            {
              action: 'NDR Logged',
              timestamp: now,
              remarks: `NDR logged from automated courier sync. Reason: ${courierStatus}`
            }
          ]
        };
        await db.saveNdrRecord(newNdr);
      }
    }

    // 5. WhatsApp Notification Trigger
    const waTriggerStatuses = ['Label Generated', 'Dispatched', 'OFD', 'Delivered', 'NDR', 'Return'];
    if (statusChanged && waTriggerStatuses.includes(mappedStatus)) {
      await triggerWhatsAppNotification({
        orderId: order.orderId,
        customerName: order.customerName,
        phonePrimary: order.phonePrimary,
        phoneSecondary: order.phoneSecondary,
        phoneTertiary: order.phoneTertiary,
        phoneWhatsApp: order.phoneWhatsApp,
        productName: order.productDetails,
        status: mappedStatus,
        awb: order.awb || 'N/A',
        courier: order.courier || 'N/A',
        eta: order.eta || 'N/A',
        orderValue: order.orderValue,
        paymentType: order.paymentType
      }).catch(err => console.error('Failed to trigger background direct WhatsApp from sync helper:', err));
    }

    return { updated: true, order };
  } catch (error: any) {
    console.error('Error synchronizing courier status:', error);
    return { updated: false, error: error.message || 'Courier sync failed.' };
  }
}

// Serialize webhook/poll updates for an AWB on the single-instance server.
const syncState = globalThis as typeof globalThis & { courierPendingSyncs?: Map<string, Promise<unknown>> };
const pendingSyncs = syncState.courierPendingSyncs ||= new Map<string, Promise<unknown>>();
export async function syncOrderStatus(...args: Parameters<typeof applyOrderStatus>): ReturnType<typeof applyOrderStatus> {
  const key = args[0].trim().toLowerCase();
  const previous = pendingSyncs.get(key) || Promise.resolve();
  const task = previous.catch(() => {}).then(() => applyOrderStatus(...args));
  pendingSyncs.set(key, task);
  try { return await task; }
  finally { if (pendingSyncs.get(key) === task) pendingSyncs.delete(key); }
}
