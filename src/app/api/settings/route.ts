import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SystemSettings } from '@/lib/types';

export async function GET() {
  try {
    const settings = await db.getSettings();
    const whatsappLogs = await db.getWhatsAppLogs();
    const courierLogs = await db.getCourierLogs();

    return NextResponse.json({ 
      success: true, 
      settings,
      whatsappLogs,
      courierLogs
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings and logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if it is a request to reset the database
    if (body.resetDb === true) {
      const resetState = await db.reset();
      return NextResponse.json({ 
        success: true, 
        message: 'System database successfully reset back to seed mock records.',
        settings: resetState.settings
      });
    }

    const settings = await db.getSettings();

    // Dynamically map incoming body fields onto settings
    const updatedSettings: SystemSettings = {
      otpWhatsappNumber: typeof body.otpWhatsappNumber === 'string' ? body.otpWhatsappNumber.trim() : settings.otpWhatsappNumber,
      ipWhitelist: Array.isArray(body.ipWhitelist) ? body.ipWhitelist.map((ip: string) => ip.trim()) : settings.ipWhitelist,
      isIpWhitelistEnabled: typeof body.isIpWhitelistEnabled === 'boolean' ? body.isIpWhitelistEnabled : settings.isIpWhitelistEnabled,
      autoCourierEnabled: typeof body.autoCourierEnabled === 'boolean' ? body.autoCourierEnabled : settings.autoCourierEnabled,
      dtdcActive: typeof body.dtdcActive === 'boolean' ? body.dtdcActive : settings.dtdcActive,
      xpressbeesActive: typeof body.xpressbeesActive === 'boolean' ? body.xpressbeesActive : settings.xpressbeesActive,
      deliveryActive: typeof body.deliveryActive === 'boolean' ? body.deliveryActive : settings.deliveryActive,
      aggregatorActive: typeof body.aggregatorActive === 'boolean' ? body.aggregatorActive : settings.aggregatorActive,
      dtdcConfig: body.dtdcConfig ? { ...settings.dtdcConfig, ...body.dtdcConfig } : settings.dtdcConfig,
      xpressbeesConfig: body.xpressbeesConfig ? { ...settings.xpressbeesConfig, ...body.xpressbeesConfig } : settings.xpressbeesConfig,
      deliveryConfig: body.deliveryConfig ? { ...settings.deliveryConfig, ...body.deliveryConfig } : settings.deliveryConfig,
    };

    await db.saveSettings(updatedSettings);

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save settings' }, { status: 500 });
  }
}
