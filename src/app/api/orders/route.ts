import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Order, OrderStatus } from '@/lib/types';
import { triggerWhatsAppNotification } from '@/lib/whatsapp';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query options
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') as OrderStatus | null;
    const vip = searchParams.get('vip');
    const payment = searchParams.get('payment');
    
    const sortField = searchParams.get('sortField') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    let orders = db.getOrders();

    // 1. Global search by Name, Phone, Order ID, AWB, Address
    if (search) {
      orders = orders.filter(o => 
        o.customerName.toLowerCase().includes(search) ||
        o.orderId.toLowerCase().includes(search) ||
        o.phonePrimary.includes(search) ||
        (o.phoneSecondary && o.phoneSecondary.includes(search)) ||
        (o.phoneTertiary && o.phoneTertiary.includes(search)) ||
        (o.awb && o.awb.toLowerCase().includes(search)) ||
        o.address.toLowerCase().includes(search)
      );
    }

    // 2. Status filtering
    if (status && status !== 'all' as any) {
      orders = orders.filter(o => o.status === status);
    }

    // 3. VIP filtering
    if (vip && vip !== 'all') {
      const isVip = vip === 'true';
      orders = orders.filter(o => o.isVip === isVip);
    }

    // 4. Payment filtering
    if (payment && payment !== 'all') {
      orders = orders.filter(o => o.paymentType === payment);
    }

    // 5. Sorting
    orders.sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle string dates comparison
      if (sortField === 'createdAt' || sortField === 'updatedAt') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA === undefined) return 1;
      if (valB === undefined) return -1;

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // 6. Pagination
    const totalCount = orders.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const paginatedOrders = orders.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      orders: paginatedOrders,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch orders.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customerName,
      phonePrimary,
      phoneSecondary,
      phoneTertiary,
      address,
      pincode,
      state,
      area,
      productDetails,
      paymentType,
      orderValue,
      weight,
      internalRemarks,
      isVip,
      createdBy
    } = body;

    // Validation
    if (!customerName || !phonePrimary || !address || !pincode || !productDetails || !paymentType || !orderValue || !weight || !createdBy) {
      return NextResponse.json({ error: 'Missing required order fields.' }, { status: 400 });
    }

    const stateAndArea = state && area ? { state, area } : { state: 'State Fetch Pending', area: 'Area Fetch Pending' };

    const orders = db.getOrders();
    
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

    const settings = db.getSettings();
    let assignedCourier: 'DTDC' | 'XpressBees' | 'Delhivery' | 'Aggregator' | undefined = undefined;

    // Apply auto courier routing engine if enabled
    if (settings.autoCourierEnabled) {
      if (weight < 1) {
        assignedCourier = 'DTDC';
      } else if (weight >= 1 && weight < 2) {
        assignedCourier = 'XpressBees';
      } else {
        assignedCourier = 'Delhivery';
      }
    }

    const now = new Date().toISOString();
    const newOrder: Order = {
      id: nextId,
      orderId: nextOrderId,
      customerName,
      phonePrimary,
      phoneSecondary: phoneSecondary || undefined,
      phoneTertiary: phoneTertiary || undefined,
      address,
      pincode,
      state: stateAndArea.state,
      area: stateAndArea.area,
      productDetails,
      paymentType,
      orderValue: parseFloat(orderValue),
      weight: parseFloat(weight),
      createdBy,
      isVip: !!isVip,
      status: 'Created',
      courier: assignedCourier,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          status: 'Created',
          timestamp: now,
          updatedBy: createdBy,
          remarks: `Order manually created by ${createdBy}.${assignedCourier ? ` Auto-routed to ${assignedCourier} based on package weight.` : ''}`
        }
      ]
    };

    // Save order in database
    db.saveOrder(newOrder);

    // Trigger real WhatsApp in background directly, bypassing loopback network dependencies
    triggerWhatsAppNotification({
      orderId: nextOrderId,
      customerName,
      phonePrimary,
      phoneSecondary,
      status: 'Created', // Use 'Created' status for order confirmation notification
      awb: newOrder.awb || 'PENDING',
      courier: newOrder.courier || 'PENDING',
      orderValue: newOrder.orderValue,
      paymentType: newOrder.paymentType
    }).catch(err => console.error('Failed to trigger background direct WhatsApp:', err));

    return NextResponse.json({ success: true, order: newOrder });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create order.' }, { status: 500 });
  }
}
