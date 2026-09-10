import { db } from '@/lib/db';
import { WhatsAppLog } from '@/lib/types';
import { WalabzClient } from '@/lib/walabz';
import { generatePackingSlipImage } from '@/lib/screenshot';

export interface TriggerWhatsAppParams {
  orderId: string;
  customerName: string;
  phonePrimary: string;
  phoneSecondary?: string;
  phoneTertiary?: string;
  phoneWhatsApp?: string;
  status: string;
  awb?: string;
  courier?: string;
  eta?: string;
  orderValue: number | string;
  paymentType: string;
  productName?: string;
  baseUrl?: string;
  targetNumbers?: string[];
  isOnDemand?: boolean;
}

/**
 * Initializes a Walabz client with dynamic settings from database or environment.
 */
export async function getWalabzClient(): Promise<WalabzClient> {
  const settings = await db.getSettings();
  return new WalabzClient({
    baseUrl: settings.walabzBaseUrl,
    username: settings.walabzUsername,
    password: settings.walabzPassword,
    apiKey: settings.walabzApiKey,
    defaultCountryCode: settings.walabzDefaultCountryCode || 'IN',
    defaultDialCode: settings.walabzDefaultDialCode || '91',
  });
}

/**
 * Builds comprehensive template variable dictionary supporting both
 * positional variables ("1", "2", ...) and named variables ("customer_name", "order_id", ...).
 */
export function buildTemplateVariables(data: {
  customerName: string;
  orderId: string;
  productName: string;
  orderValue: number | string;
  awb?: string;
  courier?: string;
  eta?: string;
  trackingUrl?: string;
  packingSlipUrl?: string;
  supportName?: string;
  supportNumber?: string;
  courierSupportName?: string;
  courierSupportNumber?: string;
  brandName?: string;
  status?: string;
  templateId?: string;
}): Record<string, string> {
  const {
    customerName,
    orderId,
    productName,
    orderValue,
    awb = 'N/A',
    courier = 'N/A',
    eta = '3-4 Days',
    trackingUrl = '',
    packingSlipUrl = '',
    supportName = 'Customer Support',
    supportNumber = '',
    courierSupportName = 'Courier Helpdesk',
    courierSupportNumber = '',
    brandName = '99Store',
    status = 'Created'
  } = data;

  const valueStr = String(orderValue || '0');

  // Base variable dictionary supporting both Meta named variables and sequential positional variables
  const mappings: Record<string, string> = {
    // Named variables (for custom & named-variable Meta templates)
    customer_name: customerName,
    first_name: customerName.split(' ')[0] || customerName,
    order_id: orderId,
    product_name: productName,
    amount: valueStr,
    order_value: valueStr,
    awb: awb,
    courier: courier,
    courier_partner: courier,
    eta: eta,
    tracking_url: trackingUrl || packingSlipUrl,
    packing_slip_url: packingSlipUrl,
    support_name: supportName,
    support_number: supportNumber,
    support_phone: supportNumber,
    courier_support_name: courierSupportName,
    courier_support_number: courierSupportNumber,
    brand_name: brandName,

    // Positional variables (Sequential 1..10)
    // For 'Created' / order confirmation (matches approved template orderconfirmation):
    // {{1}} = customer_name, {{2}} = product_name, {{3}} = order_id, {{4}} = amount, {{5}} = support_name, {{6}} = support_phone
    '1': customerName,
    '2': productName,
    '3': orderId,
    '4': valueStr,
    '5': supportName,
    '6': supportNumber,
    '7': eta,
    '8': trackingUrl || packingSlipUrl || 'https://99store.in',
    '9': supportNumber,
    '10': brandName,
  };

  // If status is shipping / logistics event, adapt positional variables 5 & 6 to AWB & Courier
  if (['Dispatched', 'RDC', 'OFD', 'Delivered', 'Label Generated', 'NDR', 'Return'].includes(status)) {
    mappings['5'] = awb && awb !== 'PENDING' ? awb : 'N/A';
    mappings['6'] = courier && courier !== 'PENDING' ? courier : 'N/A';
  }

  return mappings;
}

/**
 * Formats a human-readable fallback message preview for internal audit and log console.
 */
function buildMessagePreview(
  status: string,
  params: {
    customerName: string;
    orderId: string;
    productName: string;
    orderValue: number | string;
    awb?: string;
    courier?: string;
    eta?: string;
    packingSlipUrl?: string;
    brandName: string;
    supportName: string;
    supportNumber: string;
  }
): string {
  const { customerName, orderId, productName, orderValue, awb, courier, eta, packingSlipUrl, brandName, supportName, supportNumber } = params;

  switch (status) {
    case 'Created':
      return `🙏 ऑर्डर कन्फर्मेशन संदेश\nनमस्कार ${customerName}, आपका ${brandName} ऑर्डर #${orderId} (${productName}) कन्फर्म हो गया है। कुल राशि: ₹${orderValue}.\nसहायता: ${supportName} (${supportNumber})`;
    case 'Dispatched':
      return `🚚 ऑर्डर डिस्पैच अपडेट\nनमस्कार ${customerName}, आपका ${brandName} ऑर्डर #${orderId} डिस्पैच हो गया है।\nAWB: ${awb || 'N/A'}, कूरियर: ${courier || 'N/A'}, अनुमानित डिलीवरी: ${eta || '3-4 Days'}.\nस्लिप: ${packingSlipUrl || ''}`;
    case 'RDC':
      return `📍 डिलीवरी सेंटर अपडेट\nनमस्कार ${customerName}, आपका ऑर्डर #${orderId} नज़दीकी डिलीवरी सेंटर पर पहुँच चुका है।\nAWB: ${awb || 'N/A'}`;
    case 'OFD':
      return `🚚 आउट फॉर डिलीवरी\nनमस्कार ${customerName}, आपका ऑर्डर #${orderId} आज डिलीवरी के लिए निकल चुका है।\nAWB: ${awb || 'N/A'}`;
    case 'Delivered':
      return `✅ डिलीवरी सफल\nनमस्कार ${customerName}, आपका ${brandName} ऑर्डर #${orderId} सफलतापूर्वक डिलीवर हो गया है।`;
    case 'NDR':
      return `⚠️ डिलीवरी अपडेट (NDR)\nनमस्कार ${customerName}, आपका ऑर्डर #${orderId} डिलीवर नहीं हो पाया। हम जल्द ही पुनः प्रयास करेंगे।`;
    case 'Return':
      return `🔄 रिटर्न अपडेट\nनमस्कार ${customerName}, आपका ऑर्डर #${orderId} RTO/रिटर्न प्रक्रिया में है।`;
    default:
      return `Hello ${customerName}, your ${brandName} order #${orderId} status update: ${status}.`;
  }
}

/**
 * Resolves the configured Walabz template ID for an OMS order status.
 */
function resolveTemplateId(status: string, templates?: Record<string, string>): string | undefined {
  if (!templates) return undefined;
  
  // Direct match (e.g. 'Dispatched' or 'Created')
  if (templates[status]) return templates[status];

  // Normalized lowercase match
  const lower = status.toLowerCase();
  for (const [key, val] of Object.entries(templates)) {
    if (key.toLowerCase() === lower) return val;
  }

  // Canonical event aliases
  if (['created', 'order created', 'confirmed', 'order confirmation'].includes(lower)) {
    return templates['Created'] || templates['order_created'] || templates['order_confirmation'];
  }
  if (['dispatched', 'dispatch', 'shipped'].includes(lower)) {
    return templates['Dispatched'] || templates['order_dispatched'];
  }
  if (['ofd', 'out for delivery'].includes(lower)) {
    return templates['OFD'] || templates['out_for_delivery'];
  }
  if (['delivered', 'delivery'].includes(lower)) {
    return templates['Delivered'] || templates['order_delivered'];
  }
  if (['rdc', 'reached delivery center'].includes(lower)) {
    return templates['RDC'] || templates['order_rdc'];
  }
  if (['ndr', 'undelivered'].includes(lower)) {
    return templates['NDR'] || templates['order_ndr'];
  }
  if (['return', 'rto'].includes(lower)) {
    return templates['Return'] || templates['order_return'];
  }

  return undefined;
}

/**
 * Enterprise Transactional WhatsApp Dispatcher
 * Sends Meta-approved WhatsApp Business notifications via Walabz campaigns.
 */
export async function triggerWhatsAppNotification(params: TriggerWhatsAppParams): Promise<WhatsAppLog[]> {
  const {
    orderId,
    customerName,
    phonePrimary,
    phoneSecondary,
    phoneTertiary,
    phoneWhatsApp,
    status,
    awb,
    courier,
    eta,
    orderValue,
    paymentType,
    productName,
    baseUrl,
    targetNumbers,
    isOnDemand
  } = params;

  const logsSent: WhatsAppLog[] = [];
  const settings = await db.getSettings();

  const isEnabled = settings.whatsappNotificationsEnabled !== false;
  const brandName = settings.whatsappBrandName || '99Store';
  const supportName = settings.whatsappSupportName || '99Store Support';
  const supportNumber = settings.whatsappSupportNumber || settings.primaryContactNumbers?.[0] || '+91 8439581832';
  const courierSupportName = settings.whatsappCourierSupportName || 'Courier Helpdesk';
  const courierSupportNumber = settings.whatsappCourierSupportNumber || settings.secondaryContactNumbers?.[0] || '+91 9123456789';

  // Recipient resolution: Always target the customer's actual phone numbers
  const order = await db.getOrderByOrderId(orderId);
  const allNumbers = new Set<string>();

  if (targetNumbers && targetNumbers.length > 0) {
    targetNumbers.forEach(n => allNumbers.add(n.trim()));
  } else {
    // 1. Identify store admin and hub numbers to avoid spamming merchant phones
    const storeNumbers = new Set(
      [
        ...(settings.primaryContactNumbers || []),
        ...(settings.secondaryContactNumbers || []),
        '9876543210',
        '9123456789',
        '+91 9876543210',
        '+91 9123456789'
      ].map(n => n.replace(/\D/g, ''))
    );

    // 2. Identify candidate customer numbers in priority order
    const customerCandidates = [
      phoneWhatsApp,
      order?.phoneWhatsApp,
      phoneTertiary,
      order?.phoneTertiary,
      phonePrimary,
      order?.phonePrimary,
      phoneSecondary,
      order?.phoneSecondary
    ].filter(n => n && typeof n === 'string' && n.trim().length >= 10) as string[];

    // 3. Add numbers that are NOT the store's own admin/hub contacts
    let customerFound = false;
    for (const num of customerCandidates) {
      const clean = num.replace(/\D/g, '');
      const last10 = clean.slice(-10);
      if (!storeNumbers.has(clean) && !storeNumbers.has(last10)) {
        allNumbers.add(num.trim());
        customerFound = true;
      }
    }

    // 4. Fallback: if no dedicated non-store number found, use primary phone
    if (!customerFound && phonePrimary) {
      allNumbers.add(phonePrimary.trim());
    }
  }

  const uniqueNumbers = Array.from(allNumbers).filter(n => n && n.trim().length >= 10);
  if (uniqueNumbers.length === 0) {
    console.warn(`[WhatsApp Dispatcher] No valid recipient phone numbers found for order ${orderId}.`);
    return logsSent;
  }

  const pName = productName || order?.productDetails || '99Store Product';
  const resolvedBaseUrl = baseUrl || 'https://99-store-oms.vercel.app';
  const packingSlipUrl = `${resolvedBaseUrl}/packing-slip/${orderId}`;
  const trackingUrl = awb && awb !== 'PENDING' ? `${resolvedBaseUrl}/track?awb=${encodeURIComponent(awb)}` : packingSlipUrl;

  // Generate optional high-DPI packing slip image URL for media-header templates
  let imageUrl: string | null = null;
  const shouldAttachMedia = ['Dispatched', 'RDC', 'OFD', 'Delivered', 'Label Generated'].includes(status);
  if (shouldAttachMedia) {
    try {
      imageUrl = await generatePackingSlipImage(orderId, resolvedBaseUrl);
    } catch (err) {
      console.warn(`[WhatsApp Dispatcher] Failed to generate packing slip screenshot for ${orderId}:`, err);
    }
  }

  // Resolve template ID mapped in settings
  const templateId = resolveTemplateId(status, settings.walabzTemplates);

  // Build variable dictionary
  const variableMappings = buildTemplateVariables({
    customerName,
    orderId,
    productName: pName,
    orderValue,
    awb,
    courier,
    eta,
    trackingUrl,
    packingSlipUrl,
    supportName,
    supportNumber,
    courierSupportName,
    courierSupportNumber,
    brandName,
    status,
    templateId
  });

  // Human-readable fallback message preview for database logs
  const messagePreview = buildMessagePreview(status, {
    customerName,
    orderId,
    productName: pName,
    orderValue,
    awb,
    courier,
    eta,
    packingSlipUrl,
    brandName,
    supportName,
    supportNumber,
  });

  const testRecipient = (settings.otpWhatsappNumber || '8439762192').replace(/\D/g, '');
  const walabzClient = new WalabzClient({
    baseUrl: settings.walabzBaseUrl,
    username: settings.walabzUsername,
    password: settings.walabzPassword,
    apiKey: settings.walabzApiKey,
    defaultCountryCode: settings.walabzDefaultCountryCode || 'IN',
    defaultDialCode: settings.walabzDefaultDialCode || '91',
  });

  for (const phone of uniqueNumbers) {
    const cleanPhone = walabzClient.normalizePhoneNumber(phone);
    const isTestRecipient = cleanPhone.endsWith(testRecipient) || testRecipient.endsWith(cleanPhone);

    // Global toggle check
    if (!isEnabled && !isTestRecipient) {
      console.log(`[WhatsApp Dispatcher] Notifications globally disabled. Blocked recipient: ${cleanPhone}`);
      const log: WhatsAppLog = {
        id: `wa-${orderId}-${cleanPhone}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        phone: cleanPhone,
        type: phone === phonePrimary ? 'Primary' : 'Secondary',
        message: `${messagePreview}\n\n[Blocked: WhatsApp notifications globally disabled]`,
        status: 'Failed',
        orderId: order?.orderId || orderId,
        templateName: status,
        errorDetail: 'Blocked: WhatsApp notifications are disabled in settings.'
      };
      await db.addWhatsAppLog(log);
      logsSent.push(log);
      continue;
    }

    // Rate-limiting check: Prevent duplicate alerts for same order & status within 60 seconds
    if (!isOnDemand) {
      const existingLogs = await db.getWhatsAppLogs();
      const recentDuplicate = existingLogs.find(
        l =>
          l.orderId === (order?.orderId || orderId) &&
          l.phone === cleanPhone &&
          l.templateName === status &&
          Date.now() - new Date(l.timestamp).getTime() < 60000
      );
      if (recentDuplicate) {
        console.log(`[WhatsApp Dispatcher] Rate-limit skip: Duplicate message recently sent to ${cleanPhone} for order ${orderId}`);
        continue;
      }
    }

    const logId = `wa-${Date.now()}-${cleanPhone.slice(-4)}`;
    const log: WhatsAppLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      phone: cleanPhone,
      type: phone === phonePrimary ? 'Primary' : 'Secondary',
      message: messagePreview,
      status: 'Pending',
      orderId: order?.orderId || orderId,
      templateName: status,
      templateId: templateId,
      imageUrl: imageUrl
    };

    // If template ID is not configured, record log with warning
    if (!templateId) {
      log.status = 'Failed';
      log.errorDetail = `No Walabz template ID mapped for status '${status}'. Please configure in Settings -> Walabz Templates.`;
      log.message = `${messagePreview}\n\n⚠️ Template Unmapped: Configure Walabz Template ID for '${status}' in Settings.`;
      await db.addWhatsAppLog(log);
      logsSent.push(log);
      console.warn(`[WhatsApp Dispatcher] No Walabz template configured for status '${status}'. Logged with ID: ${logId}`);
      continue;
    }

    // Dispatch via Walabz Campaign API
    try {
      const campaignName = `Ord-${orderId}-${status}-${Date.now()}`.slice(0, 50);
      const result = await walabzClient.sendCampaign({
        campaignName,
        templateId,
        recipients: [cleanPhone],
        variableMappings,
        mediaUrl: imageUrl || undefined,
        mediaType: imageUrl ? 'image' : undefined,
        action: 'send'
      });

      if (result.success) {
        log.status = 'Sent';
        log.campaignId = result.campaignId;
        log.message = `${messagePreview}\n\n🚀 Walabz Campaign ID: ${result.campaignId}`;
        console.log(`[WhatsApp Dispatcher] Successfully queued Walabz campaign ${result.campaignId} for order ${orderId} (${cleanPhone})`);
      } else {
        log.status = 'Failed';
        log.errorDetail = result.error;
        log.message = `${messagePreview}\n\n❌ Walabz Error: ${result.error}`;
        console.error(`[WhatsApp Dispatcher] Walabz dispatch failed for ${cleanPhone}:`, result.error);
      }
    } catch (err: any) {
      log.status = 'Failed';
      log.errorDetail = err.message || 'Dispatch exception';
      log.message = `${messagePreview}\n\n❌ Exception: ${err.message}`;
      console.error(`[WhatsApp Dispatcher] Unexpected exception during send to ${cleanPhone}:`, err);
    }

    await db.addWhatsAppLog(log);
    logsSent.push(log);
  }

  return logsSent;
}

/**
 * Sends a secure Login Verification OTP code via Walabz WhatsApp Business API.
 */
export async function sendLoginOTP(
  phone: string,
  otp: string
): Promise<{ success: boolean; error?: string; campaignId?: string }> {
  const settings = await db.getSettings();
  const walabzClient = new WalabzClient({
    baseUrl: settings.walabzBaseUrl,
    username: settings.walabzUsername,
    password: settings.walabzPassword,
    apiKey: settings.walabzApiKey,
    defaultCountryCode: settings.walabzDefaultCountryCode || 'IN',
    defaultDialCode: settings.walabzDefaultDialCode || '91',
  });

  const cleanPhone = walabzClient.normalizePhoneNumber(phone);
  const otpTemplateId = settings.walabzTemplates?.['login_otp'] || settings.walabzTemplates?.['otp'];

  const messageText = `🔐 Your 99Store login verification code is: ${otp}. It is valid for 5 minutes. Do not share this code with anyone.`;

  const log: WhatsAppLog = {
    id: `wa-otp-${Date.now()}`,
    timestamp: new Date().toISOString(),
    phone: cleanPhone,
    type: 'Primary',
    message: messageText,
    templateName: 'login_otp',
    templateId: otpTemplateId,
    status: 'Pending'
  };

  // If no OTP template mapped, log failure
  if (!otpTemplateId) {
    const errorMsg = 'No Walabz template ID mapped for login_otp in Settings.';
    log.status = 'Failed';
    log.errorDetail = errorMsg;
    log.message = `${messageText}\n\n❌ ${errorMsg}`;
    await db.addWhatsAppLog(log);
    return { success: false, error: errorMsg };
  }

  try {
    const result = await walabzClient.sendCampaign({
      campaignName: `OTP-${Date.now()}`,
      templateId: otpTemplateId,
      recipients: [cleanPhone],
      variableMappings: {
        '1': otp,
        otp: otp,
        code: otp
      },
      action: 'send'
    });

    if (result.success) {
      log.status = 'Sent';
      log.campaignId = result.campaignId;
      log.message = `${messageText}\n\n🚀 Walabz Campaign: ${result.campaignId}`;
      await db.addWhatsAppLog(log);
      return { success: true, campaignId: result.campaignId };
    } else {
      log.status = 'Failed';
      log.errorDetail = result.error;
      log.message = `${messageText}\n\n❌ Walabz Error: ${result.error}`;
      await db.addWhatsAppLog(log);
      return { success: false, error: result.error };
    }
  } catch (err: any) {
    log.status = 'Failed';
    log.errorDetail = err.message || 'OTP dispatch failed';
    log.message = `${messageText}\n\n❌ Exception: ${err.message}`;
    await db.addWhatsAppLog(log);
    return { success: false, error: err.message || 'OTP dispatch network error' };
  }
}
