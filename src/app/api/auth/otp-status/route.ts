import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyOtpDispatchToken } from '@/lib/otpDispatch';
import { consumeRateLimit, getClientIp } from '@/lib/rateLimit';
import { getLoginOtpCampaignStatus } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dispatch = verifyOtpDispatchToken(
      typeof body.dispatchToken === 'string' ? body.dispatchToken : undefined,
    );
    if (!dispatch) {
      return NextResponse.json({ error: 'OTP delivery status request is invalid or expired.' }, { status: 400 });
    }

    const rateLimit = consumeRateLimit(
      `otp-status:${getClientIp(request)}:${dispatch.username}`,
      40,
      5 * 60 * 1000,
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many OTP status checks. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const deliveryStatus = await getLoginOtpCampaignStatus(dispatch.campaignId);
    const logs = await db.getWhatsAppLogs();
    const log = logs.find(item => item.campaignId === dispatch.campaignId);
    if (log && deliveryStatus !== 'queued') {
      log.status = deliveryStatus === 'sent' ? 'Sent' : 'Failed';
      if (deliveryStatus === 'failed') {
        log.errorDetail = 'Walabz failed while preparing the OTP campaign.';
      }
      await db.saveWhatsAppLog(log);
    }

    if (deliveryStatus === 'failed') {
      return NextResponse.json({
        success: false,
        deliveryStatus,
        error: 'WhatsApp could not prepare the OTP message. Please request a new OTP.',
      });
    }

    return NextResponse.json({
      success: true,
      deliveryStatus,
      message: deliveryStatus === 'sent'
        ? 'OTP sent to the configured admin WhatsApp number.'
        : 'OTP is still queued with WhatsApp.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to check OTP delivery status.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
