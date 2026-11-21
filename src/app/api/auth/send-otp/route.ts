import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateOtp, hashPassword, isOtpBypassEnabled, verifyPassword } from '@/lib/auth';
import { sendLoginOTP } from '@/lib/whatsapp';
import { maskEmail, sendLoginEmailOtp } from '@/lib/resend';
import { consumeRateLimit, getClientIp } from '@/lib/rateLimit';
import {
  createOtpDispatchToken,
  getOtpResendCooldownSeconds,
  OTP_RESEND_COOLDOWN_SECONDS,
} from '@/lib/otpDispatch';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, channel: requestedChannel } = body;

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

    const settings = await db.getSettings();
    const targetPhone = settings.otpWhatsappNumber?.trim();
    const targetEmail = (settings.adminOtpEmail || process.env.ADMIN_OTP_EMAIL || 'shivaynew66@gmail.com').trim();
    const activeChannel = requestedChannel || settings.otpDeliveryChannel || 'both';

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

    // Route dispatch according to selected channel
    let emailSuccess = false;
    let emailError = '';
    let waSuccess = false;
    let waCampaignId: string | undefined;
    let waDeliveryStatus: string | undefined;
    let waError = '';

    // 1. Email dispatch (if channel is 'email' or 'both')
    if (activeChannel === 'email' || activeChannel === 'both') {
      const emailRes = await sendLoginEmailOtp(targetEmail, otp, {
        resendApiKey: settings.resendApiKey,
        fromEmail: settings.resendFromEmail,
      });
      emailSuccess = emailRes.success;
      emailError = emailRes.error || '';
    }

    // 2. WhatsApp dispatch (if channel is 'whatsapp' or 'both')
    if (activeChannel === 'whatsapp' || activeChannel === 'both') {
      if (targetPhone) {
        const waRes = await sendLoginOTP(targetPhone, otp);
        waSuccess = waRes.success;
        waCampaignId = waRes.campaignId;
        waDeliveryStatus = waRes.deliveryStatus;
        waError = waRes.error || '';
      } else if (activeChannel === 'whatsapp') {
        waError = 'The admin login OTP WhatsApp number is not configured in Settings.';
      }
    }

    // 3. Fallback: If WhatsApp was exclusively requested but failed, auto-fallback to Email
    if (activeChannel === 'whatsapp' && !waSuccess) {
      console.warn(`[AUTH] WhatsApp OTP failed (${waError}). Attempting fallback to Email (${targetEmail})...`);
      const fallbackEmailRes = await sendLoginEmailOtp(targetEmail, otp, {
        resendApiKey: settings.resendApiKey,
        fromEmail: settings.resendFromEmail,
      });
      if (fallbackEmailRes.success) {
        emailSuccess = true;
      } else {
        emailError = fallbackEmailRes.error || '';
      }
    }

    // If neither channel succeeded, return error
    if (!emailSuccess && !waSuccess) {
      console.warn(`[AUTH] All OTP dispatch channels failed for ${user.username}. WA: ${waError}; Email: ${emailError}`);
      const combinedError = [waError ? `WhatsApp: ${waError}` : '', emailError ? `Email: ${emailError}` : '']
        .filter(Boolean)
        .join(' | ');
      return NextResponse.json({
        error: `Failed to deliver OTP: ${combinedError || 'Channel unavailable'}`,
      }, { status: 502 });
    }

    // Store verified OTP hash on user record
    const issuedAt = new Date();
    user.tempOtp = hashPassword(otp);
    user.tempOtpExpiry = new Date(issuedAt.getTime() + 5 * 60 * 1000).toISOString();
    user.tempOtpIssuedAt = issuedAt.toISOString();
    await db.saveUser(user);

    // Build user-friendly confirmation message
    let message = '';
    const masked = maskEmail(targetEmail);
    if (emailSuccess && waSuccess) {
      message = `OTP sent to email (${masked}) and WhatsApp (...${targetPhone?.slice(-4)})`;
    } else if (emailSuccess) {
      if (activeChannel === 'whatsapp') {
        message = `WhatsApp gateway unavailable. OTP sent to admin email (${masked})`;
      } else {
        message = `OTP sent to admin email (${masked})`;
      }
    } else {
      const isConfirmedSent = waDeliveryStatus === 'sent';
      message = isConfirmedSent
        ? `OTP sent to the admin WhatsApp number ending in ...${targetPhone?.slice(-4)}`
        : `OTP queued for the admin WhatsApp number ending in ...${targetPhone?.slice(-4)}`;
    }

    const dispatchToken = waCampaignId ? createOtpDispatchToken(waCampaignId, user.username) : '';

    return NextResponse.json({
      success: true,
      channel: emailSuccess && waSuccess ? 'both' : emailSuccess ? 'email' : 'whatsapp',
      message,
      deliveryStatus: emailSuccess ? 'sent' : (waDeliveryStatus || 'queued'),
      dispatchToken: dispatchToken || undefined,
      retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error during OTP dispatch.' }, { status: 500 });
  }
}
