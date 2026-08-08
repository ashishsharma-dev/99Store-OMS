import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const payment = searchParams.get('payment');
    const vip = searchParams.get('vip');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const courier = searchParams.get('courier');
    const search = searchParams.get('search');
    const queue = searchParams.get('queue');
    const assigned = searchParams.get('assigned');

    let orders = await db.getOrders();

    // Apply filters
    if (queue === 'packing') {
      const todayStr = new Date().toISOString().split('T')[0];
      orders = orders.filter(o => {
        const isCorrectStatus = o.status === 'Created' || o.status === 'Packing' || o.status === 'Label Generated';
        if (!isCorrectStatus) return false;
        if (o.futureDeliveryDate && o.futureDeliveryDate > todayStr) return false;
        return true;
      });
    } else if (status && status !== 'all') {
      orders = orders.filter(o => o.status === status);
    }

    if (payment && payment !== 'all') {
      orders = orders.filter(o => o.paymentType === payment);
    }
    if (vip && vip !== 'all') {
      const isVip = vip === 'true';
      orders = orders.filter(o => o.isVip === isVip);
    }
    if (courier && courier !== 'all') {
      orders = orders.filter(o => o.courier === courier);
    }
    if (assigned === 'true') {
      orders = orders.filter(o => !!o.assignedTo);
    } else if (assigned === 'false') {
      orders = orders.filter(o => !o.assignedTo);
    }

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      orders = orders.filter(o => 
        o.customerName.toLowerCase().includes(q) ||
        o.orderId.toLowerCase().includes(q) ||
        (o.phonePrimary && o.phonePrimary.includes(q)) ||
        (o.phoneSecondary && o.phoneSecondary.includes(q)) ||
        (o.awb && o.awb.toLowerCase().includes(q)) ||
        (o.pincode && o.pincode.includes(q)) ||
        (o.address && o.address.toLowerCase().includes(q))
      );
    }

    if (startDate) {
      const start = new Date(startDate).getTime();
      orders = orders.filter(o => new Date(o.createdAt).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      if (endDate.length === 10) {
        end.setHours(23, 59, 59, 999);
      }
      const endTime = end.getTime();
      orders = orders.filter(o => new Date(o.createdAt).getTime() <= endTime);
    }

    // Sort descending by creation date
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Generate CSV contents
    const headers = [
      'Order ID',
      'Customer Name',
      'Primary Phone',
      'Secondary Phone',
      'Address',
      'Pincode',
      'State',
      'Area',
      'Product Details',
      'Payment Type',
      'Order Value (INR)',
      'Weight (kg)',
      'Status',
      'Courier',
      'AWB/Tracking Number',
      'Created By',
      'Created Date'
    ];

    const escapeCsv = (str: string | undefined | null) => {
      if (!str) return '""';
      let clean = str.replace(/"/g, '""');
      if (clean.includes(',') || clean.includes('\n') || clean.includes('"')) {
        return `"${clean}"`;
      }
      return clean;
    };

    const rows = orders.map(o => [
      o.orderId,
      escapeCsv(o.customerName),
      o.phonePrimary,
      o.phoneSecondary || '',
      escapeCsv(o.address),
      o.pincode,
      escapeCsv(o.state),
      escapeCsv(o.area),
      escapeCsv(o.productDetails),
      o.paymentType,
      o.orderValue.toFixed(2),
      o.weight.toFixed(2),
      o.status,
      o.courier || 'Unassigned',
      o.awb || 'N/A',
      o.createdBy,
      o.createdAt.split('T')[0]
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    // Return the response as an Excel-compatible downloadable CSV file
    const headersResponse = new Headers();
    headersResponse.set('Content-Type', 'text/csv; charset=utf-8');
    headersResponse.set('Content-Disposition', 'attachment; filename=99store_orders_report.csv');

    return new Response(csvContent, {
      status: 200,
      headers: headersResponse
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'CSV report generation failed' }, { status: 500 });
  }
}
