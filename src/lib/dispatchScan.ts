import { Order, WhatsAppLog } from './types';
import { normalizeCustomerWhatsAppNumber } from './customerPhone';

export function findOrderForBarcode(orders: Order[], rawBarcode: unknown): Order | undefined {
  if (typeof rawBarcode !== 'string') return undefined;
  const barcode = rawBarcode.trim().toLowerCase();
  if (!barcode) return undefined;

  return orders.find(order =>
    !order.isDeleted &&
    (order.orderId.toLowerCase() === barcode || order.awb?.trim().toLowerCase() === barcode),
  );
}

export function validateOrderForDispatchScan(order: Order): string | null {
  if (!order.awb?.trim()) return 'An AWB must be generated before this parcel can be dispatched.';
  if (!normalizeCustomerWhatsAppNumber(order.phoneWhatsApp)) {
    return 'A valid customer WhatsApp number is required before dispatch.';
  }
  if (order.status !== 'Label Generated' && order.status !== 'Dispatched') {
    return `Only parcels in Label Generated status can be dispatched by barcode scan. Current status: ${order.status}.`;
  }
  return null;
}

export function hasSuccessfulDispatchNotification(logs: WhatsAppLog[], order: Order): boolean {
  const whatsapp = normalizeCustomerWhatsAppNumber(order.phoneWhatsApp);
  if (!whatsapp) return false;

  return logs.some(log =>
    log.orderId === order.orderId &&
    log.templateName === 'Dispatched' &&
    (log.status === 'Sent' || log.status === 'Queued') &&
    log.phone.replace(/\D/g, '').endsWith(whatsapp),
  );
}

