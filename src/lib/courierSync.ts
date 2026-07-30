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
    status === 'in transit' || 
    status === 'dispatched' || 
    status === 'shipped' || 
    status === 'transit' || 
    status.includes('manifest uploaded') || 
    status === 'manifested' || 
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
    status.includes('awaiting instruction')
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

  if (
    status.includes('returned to warehouse') || 
    status === 'rdc' || 
    status.includes('returned to delivery center') || 
    status.includes('returned to hub')
  ) {
    return 'RDC';
  }

  return null;
}

/**
 * Synchronizes an order's status with a live courier status, 
 * triggering db saves, order history records, WhatsApp alerts, and NDR logging.
 */
export async function syncOrderStatus(
  waybill: string,
  courierStatus: string,
  scanLocation?: string,
  customRemarks?: string,
  eta?: string
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

    const mappedStatus = mapCourierStatusToInternal(courierStatus);
    if (!mappedStatus) {
      return { updated: false, error: `Unable to map courier status: "${courierStatus}"` };
    }

    const now = new Date().toISOString();
    const locStr = scanLocation ? ` [Hub: ${scanLocation}]` : '';
    const sysRemarks = customRemarks || `Auto-synced status from ${order.courier} tracking API. Courier Status: "${courierStatus}"${locStr}.`;
    let hasChanges = false;

    // 1. Update Order Status
    if (order.status !== mappedStatus) {
      order.status = mappedStatus;
      order.updatedAt = now;
      order.history.push({
        status: mappedStatus,
        timestamp: now,
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
        order.history.push({
          status: order.status,
          timestamp: now,
          updatedBy: 'courier_api_sync',
          remarks: `Updated live estimated delivery date (ETD): ${cleanEta}`
        });
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
    const waTriggerStatuses = ['Dispatched', 'OFD', 'Delivered', 'NDR', 'Return'];
    if (waTriggerStatuses.includes(mappedStatus)) {
      triggerWhatsAppNotification({
        orderId: order.orderId,
        customerName: order.customerName,
        phonePrimary: order.phonePrimary,
        phoneSecondary: order.phoneSecondary,
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
