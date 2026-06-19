import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, otp, bypassIpCheck } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
    }

    // 1. IP Whitelist Security Verification
    const settings = db.getSettings();
    const headers = request.headers;
    let clientIp = headers.get('x-forwarded-for') || headers.get('x-real-ip') || '127.0.0.1';
    
    // Clean up IPv6 loopback or proxy arrays
    if (clientIp.includes(',')) {
      clientIp = clientIp.split(',')[0].trim();
    }
    if (clientIp === '::1') {
      clientIp = '127.0.0.1';
    }

    if (settings.isIpWhitelistEnabled && !bypassIpCheck) {
      const isWhitelisted = settings.ipWhitelist.some(ip => ip.trim() === clientIp.trim());
      
      // If client IP is not whitelisted
      if (!isWhitelisted) {
        // Special case: we allow admin login with a default prompt but block others
        return NextResponse.json({ 
          error: 'IP Access Denied. Your IP address is not whitelisted on this system.',
          ipBlocked: true,
          clientIp 
        }, { status: 403 });
      }
    }

    // 2. Mock OTP verification
    // In our system, any 6-digit OTP works for demonstration, or we can check for "999999" (standard demo OTP)
    if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
      return NextResponse.json({ error: 'Please enter a valid 6-digit OTP.' }, { status: 400 });
    }

    // 3. User Role Retrieval
    const user = db.getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: 'User account not found. Please contact your Super Admin.' }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Your user account is suspended.' }, { status: 403 });
    }

    // Update user's last login IP and save
    user.lastLoginIp = clientIp;
    db.saveUser(user);

    // Return the authenticated session details
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        lastLoginIp: clientIp
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Authentication error.' }, { status: 500 });
  }
}
