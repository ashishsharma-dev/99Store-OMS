import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getGoogleSheetWebhookUrl, syncBatchOrdersToGoogleSheet, syncOrderToGoogleSheet } from '@/lib/googleSheet';

export async function GET() {
  try {
    const webhookUrl = await getGoogleSheetWebhookUrl();
    const allOrders = await db.getOrders();
    const activeOrders = allOrders.filter(o => !o.isDeleted);

    return NextResponse.json({
      success: true,
      configured: Boolean(webhookUrl && webhookUrl.length > 0),
      webhookUrl: webhookUrl || null,
      totalOrders: activeOrders.length
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch status' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { orderId, orderIds, fullSync } = body;

    const webhookUrl = await getGoogleSheetWebhookUrl();
    if (!webhookUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Sheet Webhook URL is not configured. Please set GOOGLE_SHEET_WEBHOOK_URL in settings or .env.local.'
        },
        { status: 400 }
      );
    }

    // 1. Single order sync
    if (orderId) {
      const order = await db.getOrderByOrderId(orderId) || await db.getOrderById(orderId);
      if (!order) {
        return NextResponse.json({ success: false, error: `Order ${orderId} not found.` }, { status: 404 });
      }
      const result = await syncOrderToGoogleSheet(order);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 502 });
      }
      return NextResponse.json({ success: true, message: `Order ${order.orderId} synchronized successfully.` });
    }

    // 2. Specific list of orderIds
    if (Array.isArray(orderIds) && orderIds.length > 0) {
      const allOrders = await db.getOrders();
      const targetOrders = allOrders.filter(
        o => !o.isDeleted && (orderIds.includes(o.id) || orderIds.includes(o.orderId))
      );
      const result = await syncBatchOrdersToGoogleSheet(targetOrders, 100);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error, syncedCount: result.syncedCount }, { status: 502 });
      }
      return NextResponse.json({
        success: true,
        message: `Successfully synced ${result.syncedCount} orders to Google Sheet.`,
        syncedCount: result.syncedCount
      });
    }

    // 3. Full sync of all active orders
    const allOrders = await db.getOrders();
    const activeOrders = allOrders.filter(o => !o.isDeleted);

    if (activeOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active orders found to sync.',
        syncedCount: 0
      });
    }

    const result = await syncBatchOrdersToGoogleSheet(activeOrders, 100);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          syncedCount: result.syncedCount,
          total: activeOrders.length
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized all ${result.syncedCount} orders to Google Sheet!`,
      syncedCount: result.syncedCount,
      total: activeOrders.length
    });

  } catch (err: any) {
    console.error('[API Google Sheet Sync] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error while syncing with Google Sheet.' },
      { status: 500 }
    );
  }
}
