import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enqueueBulkJob } from '@/lib/courierQueue';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderIds, courier, username } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Missing or empty orderIds array.' }, { status: 400 });
    }

    if (!courier) {
      return NextResponse.json({ error: 'Missing courier partner selection.' }, { status: 400 });
    }

    const job = await enqueueBulkJob(orderIds, courier, username || 'system');
    return NextResponse.json({ success: true, job });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create bulk job.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
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
