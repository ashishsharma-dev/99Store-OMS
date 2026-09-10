import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { triggerWhatsAppNotification, getWalabzClient } from '@/lib/whatsapp';

/**
 * GET /api/integrations/whatsapp
 * Tests connection with Walabz API and returns active approved templates
 */
export async function GET() {
  try {
    const settings = await db.getSettings();
    const client = await getWalabzClient();

    let templates: any[] = [];
    let connected = false;
    let connectionError: string | undefined;

    try {
      templates = await client.getTemplates();
      connected = true;
    } catch (err: any) {
      connectionError = err.message;
    }

    return NextResponse.json({
      success: true,
      connected,
      error: connectionError,
      templates,
      walabzBaseUrl: settings.walabzBaseUrl || 'https://walabz.com',
      hasApiKey: !!settings.walabzApiKey,
      hasCredentials: !!(settings.walabzUsername && settings.walabzPassword),
      configuredTemplates: settings.walabzTemplates || {},
      notificationsEnabled: settings.whatsappNotificationsEnabled !== false,
      testRecipient: settings.otpWhatsappNumber || '8439762192'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/integrations/whatsapp
 * Actions:
 * - 'test_connection': validates credentials against Walabz
 * - 'fetch_templates': retrieves templates list from Walabz
 * - 'send_test': sends a test campaign to a specified recipient
 * - 'check_progress': polls status of a Walabz campaign
 * - Default: dispatches transactional order notification
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action;

    // 1. Action: Test Connection
    if (action === 'test_connection') {
      const client = await getWalabzClient();
      const testRes = await client.testConnection();
      return NextResponse.json(testRes);
    }

    // 2. Action: Fetch Templates
    if (action === 'fetch_templates') {
      const client = await getWalabzClient();
      const statusFilter = body.status; // e.g. 'approved'
      const templates = await client.getTemplates(statusFilter);
      return NextResponse.json({ success: true, templates });
    }

    // 3. Action: Send Test Campaign
    if (action === 'send_test') {
      const { phone, templateId, variableMappings } = body;
      if (!phone || !templateId) {
        return NextResponse.json(
          { error: 'Recipient phone and templateId are required for test message.' },
          { status: 400 }
        );
      }

      const client = await getWalabzClient();
      const result = await client.sendCampaign({
        campaignName: `Test-${Date.now()}`,
        templateId,
        recipients: [phone],
        variableMappings: variableMappings || { '1': 'Test User', '2': 'TEST-99' },
        action: 'send'
      });

      return NextResponse.json(result);
    }

    // 4. Action: Check Campaign Progress
    if (action === 'check_progress') {
      const { campaignId } = body;
      if (!campaignId) {
        return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
      }

      const client = await getWalabzClient();
      const progress = await client.getCampaignProgress(campaignId);
      return NextResponse.json({ success: true, progress });
    }

    // 5. Default Action: Trigger Order WhatsApp Notification
    const { 
      orderId, 
      customerName, 
      phonePrimary, 
      phoneSecondary, 
      status, 
      awb, 
      courier, 
      eta, 
      orderValue, 
      paymentType,
      targetNumbers,
      isOnDemand
    } = body;

    if (!orderId || !customerName || !phonePrimary || !status) {
      return NextResponse.json(
        { error: 'Missing required parameters (orderId, customerName, phonePrimary, status)' },
        { status: 400 }
      );
    }

    const baseUrl = new URL(request.url).origin;
    const logs = await triggerWhatsAppNotification({
      orderId,
      customerName,
      phonePrimary,
      phoneSecondary,
      status,
      awb,
      courier,
      eta,
      orderValue,
      paymentType,
      baseUrl,
      targetNumbers,
      isOnDemand
    });

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'WhatsApp API Integration action failed.' },
      { status: 500 }
    );
  }
}
