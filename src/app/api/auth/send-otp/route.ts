import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateOtp } from '@/lib/auth';
import { sendLoginOTP } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
    }

    // Retrieve user by username
    const user = await db.getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: 'User account not found. Please contact your Super Admin.' }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Your user account is suspended.' }, { status: 403 });
    }

    // Verify password if the user has one configured
    if (!user.password) {
      return NextResponse.json({ error: 'Password has not been set for this account. Please contact your Super Admin to configure a password.' }, { status: 400 });
    }

    if (hashPassword(password) !== user.password) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
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
    user.tempOtp = otp;
    user.tempOtpExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    await db.saveUser(user);

    // Log the generated OTP for developer convenience in local testing
    console.log(`[AUTH] Generated login OTP for ${user.username} (Target Phone: ${targetPhone}): ${otp}`);

    // Send via WhatsApp
    const waRes = await sendLoginOTP(targetPhone, otp);

    if (!waRes.success) {
      console.warn(`[AUTH] WhatsApp send failed for ${targetPhone}. Generated OTP is: ${otp}. Error: ${waRes.error}`);
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
