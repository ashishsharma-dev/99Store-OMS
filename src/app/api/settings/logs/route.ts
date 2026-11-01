import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getActiveSession } from '@/lib/authorization';

export async function GET(request: Request) {
  try {
    const session = await getActiveSession(request);
    if (session?.role !== 'Super Admin') {
      return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') === 'whatsapp' ? 'whatsapp' : 'courier';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '25') || 25));
    const search = searchParams.get('search')?.trim() || '';
    const result = type === 'whatsapp'
      ? await db.queryWhatsAppLogs(page, limit, search)
      : await db.queryCourierLogs(page, limit, search);

    return NextResponse.json({
      success: true,
      logs: result.items,
      pagination: {
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: result.limit,
      },
    });
  } catch (error) {
    console.error('[Settings logs] Failed to load logs:', error);
    return NextResponse.json({ error: 'Failed to load logs.' }, { status: 500 });
  }
}
