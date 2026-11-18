import { NextResponse } from 'next/server';
import {
  db,
  filterOrdersInMemory,
  isOrderBooked,
  isOrderPartiallyPaid,
  isOrderPaymentSettled,
} from '@/lib/db';

function normalizeDateBound(value: string | null, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (endOfDay && value.length === 10) {
    parsed.setHours(23, 59, 59, 999);
  }
  return parsed.toISOString();
}

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
    const labelPrintedParam = searchParams.get('labelPrinted');
    const bookedParam = searchParams.get('booked');
    const paymentSettledParam = searchParams.get('paymentSettled');
    const createdByParam = searchParams.get('createdBy');
    const assignedToParam = searchParams.get('assignedTo');

    const allOrders = await db.getOrders();

    const statuses = queue === 'packing'
      ? ['Created', 'Packing', 'Label Generated']
      : status && status !== 'all'
        ? status.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;

    let orders = filterOrdersInMemory(allOrders, {
      statuses,
      payment: payment && payment !== 'all' ? payment : undefined,
      vip: vip && vip !== 'all' ? vip === 'true' : undefined,
      courier: courier && courier !== 'all' ? courier : undefined,
      labelPrinted: labelPrintedParam === 'true' ? true : labelPrintedParam === 'false' ? false : undefined,
      isBooked: bookedParam === 'true' ? true : bookedParam === 'false' ? false : undefined,
      paymentSettled: paymentSettledParam === 'settled' ? 'settled' : paymentSettledParam === 'unsettled' ? 'unsettled' : undefined,
      createdBy: createdByParam && createdByParam !== 'all' ? createdByParam.trim() : undefined,
      assignedTo: assignedToParam && assignedToParam !== 'all' ? assignedToParam.trim() : undefined,
      search: search?.trim() || undefined,
      startDate: normalizeDateBound(startDate, false),
      endDate: normalizeDateBound(endDate, true),
    });

    if (queue === 'packing') {
      const todayStr = new Date().toISOString().split('T')[0];
      orders = orders.filter(o => !o.futureDeliveryDate || o.futureDeliveryDate <= todayStr);
    }

    if (assigned === 'true') {
      orders = orders.filter(o => !!o.assignedTo);
    } else if (assigned === 'false') {
      orders = orders.filter(o => !o.assignedTo);
    }

    // Sort descending by creation date
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Generate CSV contents
    const headers = [
      'Order ID',
      'Created Date',
      'Updated Date',
      'Customer Name',
      'Customer Contact Number',
      'Customer WhatsApp Number',
      'Shipment Contact Phone',
      'Primary Dispatch Phone',
      'Secondary Dispatch Phone',
      'Additional Phone 1',
      'Additional Phone 2',
      'Address',
      'Area',
      'State',
      'Pincode',
      'Product Details',
      'Payment Type',
      'Order Value (INR)',
      'Partially Paid (INR)',
      'Final Payable (INR)',
      'Payment Marked Paid',
      'Weight (kg)',
      'Status',
      'Label Printed',
      'Shipment Booked/Scanned',
      'Courier',
      'AWB/Tracking Number',
      'Created By',
      'Assigned To'
    ];

    const escapeCsv = (str: string | undefined | null) => {
      if (!str) return '""';
      const clean = String(str).replace(/"/g, '""');
      if (clean.includes(',') || clean.includes('\n') || clean.includes('"')) {
        return `"${clean}"`;
      }
      return clean;
    };

    // Prefix phone values with a tab inside quotes so Excel displays full phone digits cleanly as text
    const escapeCsvPhone = (phone: string | undefined | null) => {
      const raw = String(phone || '').trim();
      if (!raw) return '""';
      return `"\t${raw.replace(/"/g, '""')}"`;
    };

    const rows = orders.map(o => {
      const isPartial = isOrderPartiallyPaid(o);
      const partialAmt = Number(o.partiallyPaidAmount || 0);
      const orderVal = Number(o.orderValue || 0);
      const finalPayable = o.paymentType === 'Paid' || o.isPaymentSettled
        ? 0
        : (o.finalPayableAmount ?? Math.max(0, orderVal - partialAmt));
      const paymentLabel = isPartial ? 'Partially Paid' : o.paymentType;

      return [
        escapeCsv(o.orderId),
        o.createdAt ? o.createdAt.split('T')[0] : '',
        o.updatedAt ? o.updatedAt.split('T')[0] : '',
        escapeCsv(o.customerName),
        escapeCsvPhone(o.phoneTertiary || o.phoneWhatsApp || o.phonePrimary),
        escapeCsvPhone(o.phoneWhatsApp),
        escapeCsvPhone(o.shipmentContactPhone || o.phonePrimary),
        escapeCsvPhone(o.phonePrimary),
        escapeCsvPhone(o.phoneSecondary),
        escapeCsvPhone(o.phoneAdditional1),
        escapeCsvPhone(o.phoneAdditional2),
        escapeCsv(o.address),
        escapeCsv(o.area),
        escapeCsv(o.state),
        escapeCsv(o.pincode),
        escapeCsv(o.productDetails),
        paymentLabel,
        orderVal.toFixed(2),
        partialAmt.toFixed(2),
        finalPayable.toFixed(2),
        isOrderPaymentSettled(o) ? 'Yes' : 'No',
        Number(o.weight || 0).toFixed(2),
        escapeCsv(o.status),
        o.labelPrinted ? 'Printed' : 'Not Printed',
        isOrderBooked(o) ? 'Booked' : 'Not Booked',
        escapeCsv(o.courier || 'Unassigned'),
        escapeCsvPhone(o.awb || 'N/A'),
        escapeCsv(o.createdBy),
        escapeCsv(o.assignedTo || '')
      ];
    });

    const csvContent = '\uFEFF' + [
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
