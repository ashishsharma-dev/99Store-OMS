import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Order, OrderStatus } from '@/lib/types';
import { triggerWhatsAppNotification } from '@/lib/whatsapp';
import { checkCourierServiceability } from '@/lib/utils';
import { hasAllowedRole } from '@/lib/session';
import { getActiveSession } from '@/lib/authorization';
import { normalizeCustomerWhatsAppNumber } from '@/lib/customerPhone';

function normalizeDateParam(value: string | null, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(`${value}${value.length === 10 ? (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z') : ''}`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export async function GET(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    
    // Parse query options
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status') as OrderStatus | null;
    const vip = searchParams.get('vip');
    const payment = searchParams.get('payment');
    
    const allowedSortFields = new Set(['createdAt', 'updatedAt', 'orderId', 'customerName', 'status', 'orderValue']);
    const requestedSortField = searchParams.get('sortField') || 'createdAt';
    const sortField = allowedSortFields.has(requestedSortField) ? requestedSortField : 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '50') || 50);

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const courier = searchParams.get('courier');
    const statuses = status && status !== 'all' as any
      ? status.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;
    const normalizedStartDate = normalizeDateParam(startDate);
    const normalizedEndDate = normalizeDateParam(endDate, true);
    const result = await db.queryOrders({
      search,
      statuses,
      vip: vip && vip !== 'all' ? vip === 'true' : undefined,
      payment: payment && payment !== 'all' ? payment : undefined,
      courier: courier && courier !== 'all' ? courier : undefined,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      sortField,
      sortOrder,
      page,
      limit,
    });

    return NextResponse.json({
      orders: result.items,
      pagination: {
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: result.limit
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch orders.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (!session || !hasAllowedRole(session, ['Super Admin', 'Order Team'])) {
      return NextResponse.json({ error: 'Order Team access required.' }, { status: 403 });
    }
    const body = await request.json();
    const {
      customerName,
      phonePrimary,
      phoneSecondary,
      phoneAdditional1,
      phoneAdditional2,
      phoneTertiary,
      phoneWhatsApp,
      address,
      pincode,
      state,
      area,
      productDetails,
      paymentType,
      orderValue,
      weight,
      internalRemarks,
      isVip
    } = body;

    // Validation (Module 2: weight is fixed to 0.2)
    if (!customerName || !phonePrimary || !phoneWhatsApp || !address || !pincode || !productDetails || !paymentType || !orderValue) {
      return NextResponse.json({ error: 'Missing required order fields.' }, { status: 400 });
    }

    const normalizedWhatsApp = normalizeCustomerWhatsAppNumber(phoneWhatsApp);
    if (!normalizedWhatsApp) {
      return NextResponse.json({ error: 'Enter a valid 10-digit customer WhatsApp number.' }, { status: 400 });
    }

    // Module 2: Fixed Order Weight Calibration (hardcoded default to 0.2)
    const finalWeight = 0.2;

    const stateAndArea = state && area ? { state, area } : { state: 'State Fetch Pending', area: 'Area Fetch Pending' };

    const orders = await db.getOrders();
    
    // Auto-generate new unique sequential Order ID
    let maxNum = 1000;
    orders.forEach(o => {
      const match = o.orderId.match(/99S-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextOrderId = `99S-${maxNum + 1}`;
    const nextId = `ord-${maxNum + 1}`;

    const settings = await db.getSettings();
    let assignedCourier: 'DTDC' | 'XpressBees' | 'Delhivery' | 'Shadowfax' | undefined = undefined;

    // Apply intelligent auto courier routing engine if enabled
    if (settings.autoCourierEnabled) {
      const courierCandidates: { courier: 'DTDC' | 'XpressBees' | 'Delhivery' | 'Shadowfax'; priority: number; active: boolean }[] = [
        { courier: 'DTDC', priority: settings.dtdcConfig?.priority ?? 1, active: settings.dtdcActive },
        { courier: 'XpressBees', priority: settings.xpressbeesConfig?.priority ?? 2, active: settings.xpressbeesActive },
        { courier: 'Delhivery', priority: settings.deliveryConfig?.priority ?? 3, active: settings.deliveryActive },
        { courier: 'Shadowfax', priority: settings.shadowfaxConfig?.priority ?? 4, active: settings.shadowfaxActive }
      ];

      const activeCandidates = courierCandidates
        .filter(c => c.active)
        .sort((a, b) => a.priority - b.priority);

      if (activeCandidates.length > 0) {
        const serviceableCourier = activeCandidates.find(c => checkCourierServiceability(pincode, c.courier));
        assignedCourier = (serviceableCourier || activeCandidates[0]).courier;
      }
    }

    const parsedValue = parseFloat(orderValue);
    const parsedPaidAmount = body.partiallyPaidAmount ? parseFloat(body.partiallyPaidAmount) : 0;

    if (parsedValue <= 0) {
      return NextResponse.json({ error: 'Order value must be greater than 0.' }, { status: 400 });
    }
    if (paymentType === 'Paid') {
      if (parsedPaidAmount > 0) {
        return NextResponse.json({ error: 'For prepaid (Paid) orders, the partially paid amount must be 0.' }, { status: 400 });
      }
    } else if (paymentType === 'COD') {
      if (parsedPaidAmount < 0) {
        return NextResponse.json({ error: 'Partially paid amount cannot be negative.' }, { status: 400 });
      }
      if (parsedPaidAmount >= parsedValue) {
        return NextResponse.json({ error: 'For COD orders, the partially paid amount must be less than the total order value.' }, { status: 400 });
      }
    }

    const finalPayableAmount = parsedValue - parsedPaidAmount;
    const now = new Date().toISOString();

    const newOrder: Order = {
      id: nextId,
      orderId: nextOrderId,
      customerName,
      phonePrimary,
      phoneSecondary: phoneSecondary || undefined,
      phoneAdditional1: phoneAdditional1 || settings.additionalContactNumbers1?.[0] || undefined,
      phoneAdditional2: phoneAdditional2 || settings.additionalContactNumbers2?.[0] || undefined,
      phoneTertiary: phoneTertiary || phonePrimary, // Default to primary if not distinct
      phoneWhatsApp: normalizedWhatsApp,
      address,
      pincode,
      state: stateAndArea.state,
      area: stateAndArea.area,
      productDetails,
      paymentType,
      orderValue: parsedValue,
      weight: finalWeight,
      createdBy: session.username,
      isVip: !!isVip,
      status: 'Created',
      courier: assignedCourier,
      createdAt: now,
      updatedAt: now,
      partiallyPaidAmount: parsedPaidAmount,
      finalPayableAmount: finalPayableAmount,
      history: [
        {
          status: 'Created',
          timestamp: now,
          updatedBy: session.username,
          remarks: `Order manually created by ${session.username}.${assignedCourier ? ` Auto-routed to ${assignedCourier} based on package weight.` : ''}`
        }
      ]
    };

    // Save order in database
    await db.saveOrder(newOrder);

    // Trigger real WhatsApp in background directly, bypassing loopback network dependencies
    const baseUrl = new URL(request.url).origin;
    triggerWhatsAppNotification({
      orderId: nextOrderId,
      customerName,
      phonePrimary,
      phoneSecondary,
      phoneTertiary,
      phoneWhatsApp,
      productName: productDetails,
      status: 'Created', // Use 'Created' status for order confirmation notification
      awb: newOrder.awb || 'PENDING',
      courier: newOrder.courier || 'PENDING',
      orderValue: newOrder.orderValue,
      paymentType: newOrder.paymentType,
      baseUrl
    }).catch(err => console.error('Failed to trigger background direct WhatsApp:', err));

    return NextResponse.json({ success: true, order: newOrder });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create order.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (!session || !hasAllowedRole(session, ['Super Admin', 'Order Team'])) {
      return NextResponse.json({ error: 'Order Team access required.' }, { status: 403 });
    }
    const body = await request.json();
    const { orderIds } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'No order IDs provided for bulk deletion.' }, { status: 400 });
    }

    let deletedCount = 0;
    let skippedCount = 0;
    const now = new Date().toISOString();

    for (const id of orderIds) {
      const order = await db.getOrderById(id);
      if (order && !order.isDeleted) {
        if (session.role === 'Super Admin' || (session.role === 'Order Team' && order.status === 'Created')) {
          order.isDeleted = true;
          order.deletedAt = now;
          order.deletedBy = session.username;
          order.history.push({
            status: order.status,
            timestamp: now,
            updatedBy: session.username,
            remarks: `Bulk deleted by ${session.username} (${session.role}).`
          });
          await db.saveOrder(order);
          deletedCount++;
        } else {
          skippedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bulk deletion complete: ${deletedCount} deleted, ${skippedCount} skipped due to role restrictions.`,
      deletedCount,
      skippedCount
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to execute bulk deletion.' }, { status: 500 });
  }
}
