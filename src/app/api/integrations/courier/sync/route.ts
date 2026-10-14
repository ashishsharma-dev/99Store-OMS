import { after, NextResponse } from 'next/server';
import { getActiveSession } from '@/lib/authorization';
import { syncActiveShipments } from '@/lib/trackingScheduler';
export async function POST(request: Request) {
  if (!await getActiveSession(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (new URL(request.url).searchParams.get('background') === 'true') {
    after(async () => { await syncActiveShipments(); });
    return NextResponse.json({ success: true, message: 'Tracking synchronization queued.' });
  }
  try {
    const result = await syncActiveShipments();
    return NextResponse.json({ success: result.failed === 0, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Tracking sync failed.' }, { status: 500 });
  }
}
