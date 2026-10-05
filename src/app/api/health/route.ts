import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const startTime = Date.now();
  
  try {
    await Promise.all([
      db.getOrders(),
      db.getUsers(),
      db.getSettings(),
    ]);
    
    const responseTimeMs = Date.now() - startTime;
    
    return NextResponse.json({
      status: 'healthy',
      system: '99Store OMS V2 (High-Performance Engine)',
      uptime: process.uptime(),
      responseTimeMs,
      database: 'connected',
      timestamp: new Date().toISOString()
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Health check failed';
    return NextResponse.json({
      status: 'unhealthy',
      error: message,
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
