import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateOtp, hashPassword, isOtpBypassEnabled, verifyPassword } from '@/lib/auth';
import { sendLoginOTP } from '@/lib/whatsapp';
import { consumeRateLimit, getClientIp } from '@/lib/rateLimit';
import {
  createOtpDispatchToken,
  getOtpResendCooldownSeconds,
  OTP_RESEND_COOLDOWN_SECONDS,
} from '@/lib/otpDispatch';

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

    // Login OTPs always go to the administrator-controlled number from Settings.
    const settings = await db.getSettings();
    const targetPhone = settings.otpWhatsappNumber?.trim();

    // Verify phone number exists for sending OTP
    if (!targetPhone || targetPhone.trim() === '') {
      return NextResponse.json({
        error: 'The admin login OTP WhatsApp number is not configured. Please set it on the Settings page.',
      }, { status: 400 });
    }

    const cooldownSeconds = getOtpResendCooldownSeconds(user.tempOtpIssuedAt);
    if (cooldownSeconds > 0) {
      return NextResponse.json(
        {
          error: `Please wait ${cooldownSeconds} seconds before requesting another OTP.`,
          retryAfterSeconds: cooldownSeconds,
        },
        { status: 429, headers: { 'Retry-After': String(cooldownSeconds) } },
      );
    }

    // Generate a 6-digit OTP
    const otp = generateOtp();

    if (isOtpBypassEnabled()) {
      const issuedAt = new Date();
      user.tempOtp = hashPassword(otp);
      user.tempOtpExpiry = new Date(issuedAt.getTime() + 5 * 60 * 1000).toISOString();
      user.tempOtpIssuedAt = issuedAt.toISOString();
      await db.saveUser(user);
      return NextResponse.json({
        success: true,
        message: 'Development OTP bypass is active. Use 999999.',
        deliveryStatus: 'sent',
        retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
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

    const issuedAt = new Date();
    user.tempOtp = hashPassword(otp);
    user.tempOtpExpiry = new Date(issuedAt.getTime() + 5 * 60 * 1000).toISOString();
    user.tempOtpIssuedAt = issuedAt.toISOString();
    await db.saveUser(user);

    const dispatchToken = createOtpDispatchToken(waRes.campaignId!, user.username);
    const isConfirmedSent = waRes.deliveryStatus === 'sent';

    return NextResponse.json({
      success: true,
      message: isConfirmedSent
        ? `OTP sent to the admin WhatsApp number ending in ...${targetPhone.slice(-4)}`
        : `OTP queued for the admin WhatsApp number ending in ...${targetPhone.slice(-4)}`,
      deliveryStatus: waRes.deliveryStatus || 'queued',
      dispatchToken,
      retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error during OTP dispatch.' }, { status: 500 });
  }
}
