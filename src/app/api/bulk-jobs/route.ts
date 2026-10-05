import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enqueueBulkJob } from '@/lib/courierQueue';
import { ShipmentContactType } from '@/lib/types';
import { isShipmentContactType } from '@/lib/shipmentContact';
import { hasAllowedRole } from '@/lib/session';
import { getActiveSession } from '@/lib/authorization';

export async function POST(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (!session || !hasAllowedRole(session, ['Super Admin', 'Packing Team'])) {
      return NextResponse.json({ error: 'Packing Team access required.' }, { status: 403 });
    }
    const body = await request.json();
    const { orderIds, courier, phoneBinding, contactBinding } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Missing or empty orderIds array.' }, { status: 400 });
    }

    if (!courier) {
      return NextResponse.json({ error: 'Missing courier partner selection.' }, { status: 400 });
    }

    const requestedBinding = phoneBinding || contactBinding || 'Primary';
    if (!isShipmentContactType(requestedBinding) || requestedBinding === 'Custom') {
      return NextResponse.json({ error: 'Invalid bulk shipment contact binding.' }, { status: 400 });
    }

    const job = await enqueueBulkJob(
      orderIds,
      courier,
      session.username,
      requestedBinding as Exclude<ShipmentContactType, 'Custom'>,
    );
    return NextResponse.json({ success: true, job });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create bulk job.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (!session || !hasAllowedRole(session, ['Super Admin', 'Packing Team'])) {
      return NextResponse.json({ error: 'Packing Team access required.' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (jobId) {
      const job = await db.getBulkJob(jobId);
      if (!job) {
        return NextResponse.json({ error: `Bulk job with ID ${jobId} not found.` }, { status: 404 });
      }
      return NextResponse.json({ success: true, job });
    }

    const jobs = await db.listBulkJobs();
    return NextResponse.json({ success: true, jobs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch bulk jobs.' }, { status: 500 });
  }
}
