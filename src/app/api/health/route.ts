import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const startTime = Date.now();
  
  try {
    const orders = await db.getOrders();
    const users = await db.getUsers();
    const settings = await db.getSettings();
    
    const responseTimeMs = Date.now() - startTime;
    
    return NextResponse.json({
      status: 'healthy',
      system: '99Store OMS V2 (High-Performance Engine)',
      uptime: process.uptime(),
      responseTimeMs,
      stats: {
        totalOrders: orders.length,
        totalUsers: users.length,
        isIpWhitelistEnabled: settings.isIpWhitelistEnabled,
        autoCourierEnabled: settings.autoCourierEnabled
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message
    }, { status: 500 });
  }
}
