import { Order } from './types';
import { db } from './db';

/**
 * Returns the configured Google Sheets Webhook URL.
 * Checks system settings first, falls back to environment variable.
 */
export async function getGoogleSheetWebhookUrl(): Promise<string | null> {
  try {
    const settings = await db.getSettings();
    if (settings?.googleSheetWebhookUrl && settings.googleSheetWebhookUrl.trim() !== '') {
      return settings.googleSheetWebhookUrl.trim();
    }
  } catch (err) {
    // fallback if db is not ready
  }
  return process.env.GOOGLE_SHEET_WEBHOOK_URL?.trim() || null;
}

/**
 * Formats an Order into the clean payload expected by the Google Apps Script
 */
export function formatOrderForSheet(o: Order) {
  return {
    orderId: o.orderId || '',
    createdAt: o.createdAt || new Date().toISOString(),
    customerName: o.customerName || '',
    phonePrimary: o.phonePrimary || '',
    phoneSecondary: o.phoneSecondary || o.phoneWhatsApp || '',
    address: o.address || '',
    area: o.area || '',
    state: o.state || '',
    pincode: o.pincode || '',
    productDetails: o.productDetails || '',
    paymentType: o.paymentType || 'COD',
    orderValue: o.orderValue || 0,
    partiallyPaidAmount: o.partiallyPaidAmount || 0,
    finalPayableAmount: o.finalPayableAmount || (o.orderValue || 0),
    weight: o.weight || 0,
    status: o.status || 'Created',
    courier: o.courier || '',
    awb: o.awb || '',
    handledBy: o.handledBy || o.assignedTo || o.createdBy || '',
    ndrAction: o.ndrAction || o.internalRemarks || '',
    isVip: o.isVip || false,
    updatedAt: o.updatedAt || new Date().toISOString()
  };
}

/**
 * Synchronizes a single order to the Google Sheet via Webhook.
 * Runs non-blocking / fire-and-forget so order operations are never delayed.
 */
export async function syncOrderToGoogleSheet(order: Order): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = await getGoogleSheetWebhookUrl();
  if (!webhookUrl) {
    return { success: false, error: 'Google Sheet Webhook URL not configured.' };
  }

  // Skip deleted orders from being synced
  if (order.isDeleted) {
    return { success: true };
  }

  try {
    const payload = {
      order: formatOrderForSheet(order)
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown network error');
      console.warn(`[Google Sheet Sync] HTTP error ${res.status} for order ${order.orderId}:`, errText);
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }

    const json = await res.json().catch(() => ({}));
    return { success: true };
  } catch (err: any) {
    console.warn(`[Google Sheet Sync] Failed to sync order ${order.orderId}:`, err?.message || err);
    return { success: false, error: err?.message || 'Sync request failed.' };
  }
}

/**
 * Synchronizes an array of orders to the Google Sheet in batches of up to 100.
 */
export async function syncBatchOrdersToGoogleSheet(
  orders: Order[],
  batchSize = 100
): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  const webhookUrl = await getGoogleSheetWebhookUrl();
  if (!webhookUrl) {
    return { success: false, syncedCount: 0, error: 'Google Sheet Webhook URL not configured.' };
  }

  const activeOrders = orders.filter(o => !o.isDeleted);
  if (activeOrders.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  let totalSynced = 0;

  for (let i = 0; i < activeOrders.length; i += batchSize) {
    const batch = activeOrders.slice(i, i + batchSize);
    const payload = {
      orders: batch.map(formatOrderForSheet)
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown network error');
        console.warn(`[Google Sheet Sync] Batch HTTP error ${res.status}:`, errText);
        return {
          success: false,
          syncedCount: totalSynced,
          error: `Batch sync failed at chunk ${Math.floor(i / batchSize) + 1}: ${errText}`
        };
      }

      totalSynced += batch.length;
    } catch (err: any) {
      console.warn(`[Google Sheet Sync] Batch exception:`, err?.message || err);
      return {
        success: false,
        syncedCount: totalSynced,
        error: err?.message || 'Network exception during batch sync.'
      };
    }
  }

  return { success: true, syncedCount: totalSynced };
}
