/**
 * Resend Email Integration for 99Store OMS
 * Sends transactional authentication emails (Login OTPs) via Resend HTTP API.
 */

export interface SendEmailOtpResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface SendEmailOtpOptions {
  resendApiKey?: string;
  fromEmail?: string;
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user[0]}*@${domain}`;
  }
  const start = user.slice(0, 2);
  const end = user.slice(-1);
  return `${start}${'*'.repeat(Math.max(1, user.length - 3))}${end}@${domain}`;
}

export async function sendLoginEmailOtp(
  toEmail: string,
  otp: string,
  options?: SendEmailOtpOptions
): Promise<SendEmailOtpResult> {
  const apiKey = options?.resendApiKey || process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      error: 'Resend API key is not configured. Set RESEND_API_KEY in environment or Settings.',
    };
  }

  const cleanEmail = toEmail?.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return {
      success: false,
      error: `Invalid destination email address: '${toEmail}'`,
    };
  }

  const fromAddress = options?.fromEmail || process.env.RESEND_FROM_EMAIL || '99Store OMS <onboarding@resend.dev>';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>99Store OMS Login Verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td style="padding: 40px 10px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #0F172A; padding: 28px 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">99Store OMS</h1>
              <p style="color: #94A3B8; margin: 4px 0 0 0; font-size: 13px;">Operations & Order Management System</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <p style="color: #334155; font-size: 15px; line-height: 24px; margin: 0 0 20px 0;">
                Hello,
              </p>
              <p style="color: #334155; font-size: 15px; line-height: 24px; margin: 0 0 24px 0;">
                Use the one-time verification code below to complete your login into <strong>99Store OMS</strong>:
              </p>
              <!-- Code Box -->
              <div style="background-color: #F8FAFC; border: 2px dashed #CBD5E1; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #10B981; display: inline-block;">
                  ${otp}
                </span>
              </div>
              <p style="color: #64748B; font-size: 13px; line-height: 20px; margin: 0 0 16px 0;">
                ⏳ This code will expire in <strong>5 minutes</strong>. For security reasons, do not share this code with anyone.
              </p>
              <p style="color: #94A3B8; font-size: 12px; line-height: 18px; margin: 0; border-top: 1px solid #E2E8F0; padding-top: 16px;">
                If you did not request this login code, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 16px 32px; text-align: center; border-top: 1px solid #E2E8F0;">
              <p style="color: #94A3B8; font-size: 11px; margin: 0;">
                99Store OMS Engine &bull; Automated Authentication Notification
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [cleanEmail],
        subject: `🔐 ${otp} is your 99Store OMS verification code`,
        html: htmlContent,
        text: `Your 99Store OMS verification code is: ${otp}. It expires in 5 minutes. Do not share this code.`,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data.message || data.error || `HTTP ${res.status} ${res.statusText}`;
      console.warn(`[RESEND] Failed to send email OTP to ${cleanEmail}: ${errMsg}`);
      return {
        success: false,
        error: errMsg,
      };
    }

    return {
      success: true,
      id: data.id,
    };
  } catch (err: any) {
    console.error(`[RESEND] Exception sending email OTP to ${cleanEmail}:`, err);
    return {
      success: false,
      error: err.message || 'Network error reaching Resend email service',
    };
  }
}
