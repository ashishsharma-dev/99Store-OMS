import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getActiveSession } from '@/lib/authorization';

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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const normalizedStartDate = normalizeDateParam(startDate);
    const normalizedEndDate = normalizeDateParam(endDate, true);

    const stats = await db.getOrderStats({
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
    });

    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch order statistics.' }, { status: 500 });
  }
}
