import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getActiveSession } from '@/lib/authorization';
import type { ActivityLogType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const supportedTypes = new Set<ActivityLogType>(['order', 'ndr', 'ofd', 'call_placed']);

export async function GET(request: Request) {
  try {
    if (!await getActiveSession(request)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.max(1, Math.min(2000, Number(searchParams.get('limit') || 50)));
    const search = searchParams.get('search')?.trim() || '';
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const types = (searchParams.get('type') || '')
      .split(',')
      .filter((type): type is ActivityLogType => supportedTypes.has(type as ActivityLogType));

    const result = await db.queryActivityLogs({
      page,
      limit,
      search,
      startDate,
      endDate,
      types: types.length ? types : undefined,
    });

    return NextResponse.json({
      success: true,
      logs: result.items,
      pagination: {
        page: result.currentPage,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('Failed to load activity logs:', error);
    return NextResponse.json({ error: 'Failed to load activity logs.' }, { status: 500 });
  }
}
