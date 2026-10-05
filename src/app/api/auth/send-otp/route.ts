import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateOtp, hashPassword, isOtpBypassEnabled, verifyPassword } from '@/lib/auth';
import { sendLoginOTP } from '@/lib/whatsapp';
import { consumeRateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    const rateLimit = consumeRateLimit(`send-otp:${getClientIp(request)}:${normalizedUsername}`, 5, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const user = await db.getUserByUsername(normalizedUsername);
    if (!user || !user.password || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Your user account is suspended.' }, { status: 403 });
    }

    // Retrieve system settings to check for a global OTP WhatsApp number
    const settings = await db.getSettings();
    const targetPhone = (settings.otpWhatsappNumber && settings.otpWhatsappNumber.trim() !== '') 
      ? settings.otpWhatsappNumber.trim() 
      : user.phone;

    // Verify phone number exists for sending OTP
    if (!targetPhone || targetPhone.trim() === '') {
      return NextResponse.json({ error: 'No phone number registered for OTP verification. Please contact Super Admin.' }, { status: 400 });
    }

    // Generate a 6-digit OTP
    const otp = generateOtp();
    
    // Set tempOtp and tempOtpExpiry (valid for 5 minutes)
    user.tempOtp = hashPassword(otp);
    user.tempOtpExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    await db.saveUser(user);

    if (isOtpBypassEnabled()) {
      return NextResponse.json({
        success: true,
        message: 'Development OTP bypass is active. Use 999999.'
      });
    }

    // Send via WhatsApp
    const waRes = await sendLoginOTP(targetPhone, otp);

    if (!waRes.success) {
      console.warn(`[AUTH] WhatsApp OTP dispatch failed for ${user.username}: ${waRes.error}`);
      return NextResponse.json({ 
        error: `Failed to send OTP via WhatsApp: ${waRes.error || 'Gateway issue'}` 
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: `OTP code sent to WhatsApp number ending in ...${targetPhone.slice(-4)}`
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error during OTP dispatch.' }, { status: 500 });
  }
}
