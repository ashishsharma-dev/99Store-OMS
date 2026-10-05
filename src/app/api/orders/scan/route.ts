import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getActiveSession } from '@/lib/authorization';
import { hasAllowedRole } from '@/lib/session';
import { triggerWhatsAppNotification } from '@/lib/whatsapp';
import {
  findOrderForBarcode,
  hasSuccessfulDispatchNotification,
  validateOrderForDispatchScan,
} from '@/lib/dispatchScan';

export async function POST(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (!session || !hasAllowedRole(session, ['Super Admin', 'Packing Team'])) {
      return NextResponse.json({ error: 'Packing Team access required.' }, { status: 403 });
    }

    const { barcode } = await request.json();
    const order = findOrderForBarcode(await db.getOrders(), barcode);
    if (!order) {
      return NextResponse.json({ error: 'No active order matches this barcode or AWB.' }, { status: 404 });
    }

    const validationError = validateOrderForDispatchScan(order);
    if (validationError) {
      return NextResponse.json({ error: validationError, orderId: order.orderId }, { status: 400 });
    }

    const alreadyDispatched = order.status === 'Dispatched';
    if (!alreadyDispatched) {
      const now = new Date().toISOString();
      order.status = 'Dispatched';
      order.updatedAt = now;
      order.history.push({
        status: 'Dispatched',
        timestamp: now,
        updatedBy: session.username,
        remarks: `Barcode scan confirmed warehouse dispatch for AWB ${order.awb}.`,
      });
      await db.saveOrder(order);
    }

    const existingLogs = await db.getWhatsAppLogs();
    let notificationSent = hasSuccessfulDispatchNotification(existingLogs, order);
    let notificationError: string | undefined;

    if (!notificationSent) {
      const logs = await triggerWhatsAppNotification({
        orderId: order.orderId,
        customerName: order.customerName,
        phonePrimary: order.phonePrimary,
        phoneSecondary: order.phoneSecondary,
        phoneTertiary: order.phoneTertiary,
        phoneWhatsApp: order.phoneWhatsApp,
        productName: order.productDetails,
        status: 'Dispatched',
        awb: order.awb,
        courier: order.courier || 'N/A',
        eta: order.eta || 'N/A',
        orderValue: order.orderValue,
        paymentType: order.paymentType,
        baseUrl: new URL(request.url).origin,
      });
      notificationSent = logs.some(log => log.status === 'Sent' || log.status === 'Queued');
      notificationError = logs.find(log => log.status === 'Failed')?.errorDetail;
    }

    return NextResponse.json({
      success: true,
      order,
      alreadyDispatched,
      notificationSent,
      notificationError,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to dispatch scanned parcel.' },
      { status: 500 },
    );
  }
}
