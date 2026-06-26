import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const payment = searchParams.get('payment');
    const vip = searchParams.get('vip');

    let orders = await db.getOrders();

    // Apply the same filters as the main search listing if provided
    if (status && status !== 'all') {
      orders = orders.filter(o => o.status === status);
    }
    if (payment && payment !== 'all') {
      orders = orders.filter(o => o.paymentType === payment);
    }
    if (vip && vip !== 'all') {
      const isVip = vip === 'true';
      orders = orders.filter(o => o.isVip === isVip);
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
