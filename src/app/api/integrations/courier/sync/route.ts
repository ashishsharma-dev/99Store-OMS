import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// TEMPORARILY DISABLED: Bulk courier sync is currently turned off to prevent background ECONNRESET fetch errors.
export async function POST(request: Request) {
  return NextResponse.json({
    success: false,
    disabled: true,
    message: 'Bulk courier tracking synchronization is temporarily disabled.',
    totalChecked: 0,
    totalUpdated: 0,
    updates: []
  });
}
