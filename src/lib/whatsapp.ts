import { db } from '@/lib/db';
import { WhatsAppLog } from '@/lib/types';

// Deropo WhatsApp API Credentials (configured via environment variables)
const API_URL = process.env.WHATSAPP_API_URL || 'https://api.deropo.com/api/send';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '3b66835690546597e55f36f2605c0b8a';
const DEVICE_ID = process.env.WHATSAPP_DEVICE_ID || '3483';

import { generatePackingSlipImage } from '@/lib/screenshot';



async function sendWhatsAppMessage(phone: string, messageText: string, imageUrl?: string | null): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Format phone number just like the Google Apps Script
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    // 2. Validate phone number length (11-15 digits)
    if (!/^\d{11,15}$/.test(cleanPhone)) {
      return { success: false, error: 'Invalid phone number' };
    }

    // Fetch dynamic system settings
    const settings = await db.getSettings();
    const isEnabled = settings.whatsappNotificationsEnabled !== false; // default to true if not set
    const activeAccessToken = settings.whatsappAccessToken || ACCESS_TOKEN;
    const activeDeviceId = settings.whatsappDeviceId || DEVICE_ID;
    
    // Recipient check (dynamically resolved from settings.otpWhatsappNumber, falling back to 8439762192)
    const testRecipient = settings.otpWhatsappNumber || '8439762192';
    let cleanTestRecipient = testRecipient.replace(/\D/g, '');
    if (cleanTestRecipient.length === 10) {
      cleanTestRecipient = '91' + cleanTestRecipient;
    }
    const isTestRecipient = (cleanPhone === cleanTestRecipient || cleanPhone === testRecipient);

    // If notifications are globally disabled, block all messages EXCEPT the test recipient
    if (!isEnabled && !isTestRecipient) {
      console.warn(`[WhatsApp Block] WhatsApp notifications are disabled globally.`);
      return { 
        success: false, 
        error: 'Blocked: WhatsApp notifications are disabled globally.' 
      };
    }

    // 3. Make fetch request to WhatsApp API
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (activeAccessToken) {
      headers['X-Access-Token'] = activeAccessToken;
    }

    // Construct request URL by appending device_id if not already present in the URL
    let requestUrl = API_URL;
    if (activeDeviceId && !requestUrl.includes('device_id=') && !requestUrl.includes('device=')) {
      const separator = requestUrl.includes('?') ? '&' : '?';
      requestUrl = `${requestUrl}${separator}device_id=${activeDeviceId}`;
    }

    const payload: any = {
      number: cleanPhone,
      message: messageText
    };

    if (imageUrl) {
      payload.type = 'image';
      payload.variables = {
        imageUrl: imageUrl
      };
      payload.url = imageUrl;
      payload.file = imageUrl;
      payload.media = imageUrl;
      payload.caption = messageText;
    } else {
      payload.type = 'text';
    }

    const res = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${responseText || 'Unknown error'}` };
    }

    try {
      const data = JSON.parse(responseText);
      if (data.success === true || (data.status && data.status.toLowerCase() === 'success')) {
        return { success: true };
      } else {
        return { success: false, error: data.message || 'Gateway issue' };
      }
    } catch (e) {
      return { success: false, error: `Invalid JSON response: ${responseText}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}


export interface TriggerWhatsAppParams {
  orderId: string;
  customerName: string;
  phonePrimary: string;
  phoneSecondary?: string;
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

export async function triggerWhatsAppNotification(params: TriggerWhatsAppParams): Promise<WhatsAppLog[]> {
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
    productName,
    baseUrl,
    targetNumbers,
    isOnDemand
  } = params;

  const logsSent: WhatsAppLog[] = [];

  // Load settings for dynamic template values
  const settings = await db.getSettings();
  const brandName = settings.whatsappBrandName || '99Store';
  const supportName = settings.whatsappSupportName || '99Store Support';
  const supportNumber = settings.whatsappSupportNumber || settings.primaryContactNumbers?.[0] || '+91 8439581832';
  const courierSupportName = settings.whatsappCourierSupportName || 'Courier Helpdesk';
  const courierSupportNumber = settings.whatsappCourierSupportNumber || settings.secondaryContactNumbers?.[0] || '+91 9123456789';

  // Gather all unique phone numbers associated with the parcel
  const order = await db.getOrderByOrderId(orderId);
  const allNumbers = new Set<string>();
  
  if (targetNumbers && targetNumbers.length > 0) {
    targetNumbers.forEach(num => allNumbers.add(num.trim()));
  } else {
    if (phonePrimary) allNumbers.add(phonePrimary.trim());
    if (phoneSecondary) allNumbers.add(phoneSecondary.trim());
    if (order) {
      if (order.phonePrimary) allNumbers.add(order.phonePrimary.trim());
      if (order.phoneSecondary) allNumbers.add(order.phoneSecondary.trim());
      if (order.phoneTertiary) allNumbers.add(order.phoneTertiary.trim());
      if (order.phoneWhatsApp) allNumbers.add(order.phoneWhatsApp.trim());
    }
  }
  const uniqueNumbers = Array.from(allNumbers).filter(num => num && num.trim() !== '');

  // Get product name (either from params, or fetch from DB)
  let pName = productName;
  if (!pName) {
    pName = order?.productDetails || 'Product';
  }

  // Generate packing slip screenshot in background
  let imageUrl: string | null = null;
  try {
    imageUrl = await generatePackingSlipImage(orderId, baseUrl);
  } catch (err) {
    console.error('Failed to generate packing slip screenshot:', err);
  }

  // --- 1. Primary Number Notifications ---
  let primaryMessage = '';
  switch (status) {
    case 'Created':
      primaryMessage = `🙏 ऑर्डर कन्फर्मेशन संदेश
नमस्कार ${customerName},
आपका ऑर्डर सफलतापूर्वक कन्फर्म हो गया है। 🎉

ऑर्डर विवरण:
• उत्पाद: ${pName}
• ऑर्डर आईडी: ${orderId}
• कुल राशि: ₹${orderValue}

आपका ऑर्डर जल्द ही पैक करके डिस्पैच किया जाएगा। जैसे ही आपका ऑर्डर हमारी ओर से भेजा जाएगा, हम आपको उसकी जानकारी और ट्रैकिंग विवरण भेज देंगे।


ऑर्डर सहायता
👤 ${supportName}
📞 ${supportNumber}
धन्यवाद!
– Team ${brandName}`;
      break;

    case 'Dispatched':
      primaryMessage = `🚚 ऑर्डर डिस्पैच अपडेट
नमस्कार ${customerName},
आपका ऑर्डर हमारी ओर से सफलतापूर्वक डिस्पैच कर दिया गया है। 🎉

ऑर्डर विवरण:
• उत्पाद: ${pName}
• ऑर्डर आईडी: ${orderId}
• ट्रैकिंग आईडी (AWB): ${awb || 'N/A'}
• कूरियर पार्टनर: ${courier || 'N/A'}
• अनुमानित डिलीवरी: ${eta || '3-4 Days'}

आप अपने ऑर्डर को ट्रैकिंग आईडी की सहायता से कूरियर की वेबसाइट पर ट्रैक कर सकते हैं।


🖼️ महत्वपूर्ण सूचना
इस संदेश के साथ एक लेबल की तस्वीर भेजी गई है।
कृपया डिलीवरी प्राप्त करने से पहले अपने पार्सल पर लगे लेबल का मिलान इस तस्वीर से अवश्य करें।
यदि तस्वीर और आपके पार्सल का लेबल एक जैसा है, तभी पार्सल स्वीकार करें।
यदि दोनों में कोई अंतर दिखाई दे, तो कृपया तुरंत हमारे सपोर्ट से संपर्क करें और पार्सल स्वीकार न करें।
ऑर्डर सहायता
👤 ${supportName}
📞 ${supportNumber}
कूरियर सहायता
📦 ${courierSupportName}
📞 ${courierSupportNumber}
धन्यवाद!
– Team ${brandName}`;
      break;

    case 'RDC':
      primaryMessage = `📍 आपका ऑर्डर आपके नज़दीकी डिलीवरी सेंटर पर पहुँच गया है

नमस्कार ${customerName},
आपके ऑर्डर की नवीनतम जानकारी साझा की जा रही है।

ऑर्डर विवरण:
• उत्पाद: ${pName}
• ऑर्डर आईडी: ${orderId}
• ट्रैकिंग आईडी (AWB): ${awb || 'N/A'}
• कूरियर पार्टनर: ${courier || 'N/A'}
• भुगतान राशि${paymentType === 'COD' ? ' (COD)' : ''}: ${paymentType === 'COD' ? `₹${orderValue}` : 'Prepaid'}

आपका ऑर्डर आपके नज़दीकी डिलीवरी सेंटर (RDC) पर पहुँच चुका है और डिलीवरी की प्रक्रिया में है।
संभावना है कि आपका ऑर्डर आज या कल तक आपको प्राप्त हो जाएगा।
${paymentType === 'COD' ? `कृपया डिलीवरी के समय ₹${orderValue} की राशि तैयार रखें।` : ''}


🖼️ महत्वपूर्ण सूचना
इस संदेश के साथ एक लेबल की तस्वीर भेजी गई है।
कृपया डिलीवरी प्राप्त करने से पहले अपने पार्सल पर लगे लेबल का मिलान इस तस्वीर से अवश्य करें।
यदि तस्वीर और आपके पार्सल का लेबल एक जैसा है, तभी पार्सल स्वीकार करें।
यदि दोनों में कोई अंतर दिखाई दे, तो कृपया तुरंत हमारे सपोर्ट से संपर्क करें और पार्सल स्वीकार न करें।
ऑर्डर सहायता
👤 ${supportName}
📞 ${supportNumber}
कूरियर सहायता
📦 ${courierSupportName}
📞 ${courierSupportNumber}
धन्यवाद!
– Team ${brandName}`;
      break;

    case 'OFD':
      primaryMessage = `🚚 आपका ऑर्डर डिलीवरी के लिए निकल चुका है

नमस्कार ${customerName},
खुशखबरी! 🎉
आपका ऑर्डर आज डिलीवरी के लिए निकल चुका है।

ऑर्डर विवरण:
• उत्पाद: ${pName}
• ऑर्डर आईडी: ${orderId}
• ट्रैकिंग आईडी (AWB): ${awb || 'N/A'}
• कूरियर पार्टनर: ${courier || 'N/A'}
• भुगतान राशि${paymentType === 'COD' ? ' (COD)' : ''}: ${paymentType === 'COD' ? `₹${orderValue}` : 'Prepaid'}

आपका ऑर्डर आज ही डिलीवर होने की पूरी संभावना है।
${paymentType === 'COD'
          ? `कृपया डिलीवरी के समय ₹${orderValue} की राशि तैयार रखें। साथ ही अपना मोबाइल फ़ोन उपलब्ध रखें ताकि डिलीवरी पार्टनर आवश्यकता पड़ने पर आपसे संपर्क कर सके।`
          : 'साथ ही अपना मोबाइल फ़ोन उपलब्ध रखें ताकि डिलीवरी पार्टनर आवश्यकता पड़ने पर आपसे संपर्क कर सके।'}


🖼️ महत्वपूर्ण सूचना
इस संदेश के साथ एक लेबल की तस्वीर भेजी गई है।
कृपया डिलीवरी प्राप्त करने से पहले अपने पार्सल पर लगे लेबल का मिलान इस तस्वीर से अवश्य करें।
यदि तस्वीर और आपके पार्सल का लेबल एक जैसा है, तभी पार्सल स्वीकार करें।
यदि दोनों में कोई अंतर दिखाई दे, तो कृपया तुरंत हमारे सपोर्ट से संपर्क करें और पार्सल स्वीकार न करें।
ऑर्डर सहायता
👤 ${supportName}
📞 ${supportNumber}
कूरियर सहायता
📦 ${courierSupportName}
📞 ${courierSupportNumber}
धन्यवाद!
– Team ${brandName}`;
      break;

    case 'Delivered':
      primaryMessage = `✅ आपका ऑर्डर सफलतापूर्वक डिलीवर हो गया

नमस्कार ${customerName},
हमें खुशी है कि आपका ऑर्डर सफलतापूर्वक डिलीवर हो गया है। 😊

ऑर्डर विवरण:
• उत्पाद: ${pName}
• ऑर्डर आईडी: ${orderId}

हमें आशा है कि आपको आपका उत्पाद पसंद आएगा। यदि उत्पाद से संबंधित कोई प्रश्न, समस्या या सहायता चाहिए, तो बेझिझक हमसे संपर्क करें।


🖼️ महत्वपूर्ण सूचना
इस संदेश के साथ एक लेबल की तस्वीर भेजी गई है।
कृपया डिलीवरी प्राप्त करने से पहले अपने पार्सल पर लगे लेबल का मिलान इस तस्वीर से अवश्य करें।
यदि तस्वीर और आपके पार्सल का लेबल एक जैसा है, तभी पार्सल स्वीकार करें।
यदि दोनों में कोई अंतर दिखाई दे, तो कृपया तुरंत हमारे सपोर्ट से संपर्क करें और पार्सल स्वीकार न करें।
ऑर्डर सहायता
👤 ${supportName}
📞 ${supportNumber}
यदि आपको हमारा उत्पाद और सेवा पसंद आई हो, तो कृपया अपना अनुभव अपने परिवार और मित्रों के साथ साझा करें। आपका विश्वास और सहयोग हमारे लिए बेहद महत्वपूर्ण है।

धन्यवाद! ❤️
– Team ${brandName}`;
      break;

    case 'Label Generated':
      primaryMessage = `📄 आपके ऑर्डर का शिपिंग लेबल तैयार है
नमस्कार ${customerName},
आपके ${brandName} ऑर्डर #${orderId} का शिपिंग लेबल सफलतापूर्वक जेनरेट कर दिया गया है। 

ऑर्डर विवरण:
• उत्पाद: ${pName}
• ट्रैकिंग आईडी (AWB): ${awb || 'N/A'}
• कूरियर पार्टनर: ${courier || 'N/A'}

जैसे ही आपका पार्सल कूरियर पार्टनर द्वारा पिक किया जाएगा, हम आपको शिपमेंट ट्रैकिंग जानकारी साझा करेंगे।

ऑर्डर सहायता
👤 ${supportName}
📞 ${supportNumber}
धन्यवाद!
– Team ${brandName}`;
      break;

    case 'NDR':
      primaryMessage = `⚠️ Delivery Failed! Hi ${customerName}, our courier partner was unable to deliver your ${brandName} order #${orderId}. Status: ${status}. Reason: Delivery attempt failed. Don't worry, we are scheduling a re-attempt shortly. Contact us if you wish to update details.`;
      break;

    case 'Return':
      primaryMessage = `🔄 Return Update! Hi ${customerName}, your ${brandName} order #${orderId} status has been updated to RTO (${status}). It is being shipped back to our fulfillment center. Please reach out to customer support to arrange a refund or reshipment.`;
      break;

    default:
      primaryMessage = `Hello ${customerName}, your ${brandName} order #${orderId} status has been updated to: ${status}.`;
      break;
  }

  // Generate packing slip URL and append if status is after/during label generation
  const packingSlipUrl = `${baseUrl || 'https://99-store-oms.vercel.app'}/packing-slip/${orderId}`;
  const isAfterLabelGen = status !== 'Created' && status !== 'Packing' && status !== 'Courier Selected';
  if (isAfterLabelGen) {
    const isHindi = ['Label Generated', 'Dispatched', 'RDC', 'OFD', 'Delivered'].includes(status);
    if (isHindi) {
      primaryMessage += `\n\n📄 अपनी पैकिंग स्लिप (Packing Slip) देखने के लिए यहाँ क्लिक करें:\n${packingSlipUrl}`;
    } else {
      primaryMessage += `\n\n📄 Click here to view your packing slip:\n${packingSlipUrl}`;
    }
  }

  const isTransactional = !isOnDemand;
  const scheduledTime = isTransactional
    ? new Date(Date.now() + 60000).toISOString()
    : undefined;

  // Send the detailed message to all unique numbers attached to the order
  for (const phone of uniqueNumbers) {
    const logId = `wa-dispatch-${phone}-${Date.now()}`;
    const log: WhatsAppLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      phone: phone,
      type: phone === phonePrimary ? 'Primary' : 'Secondary',
      message: primaryMessage,
      status: isTransactional ? 'Pending' : 'Failed', // Pending for transactional, placeholder for manual
      orderId: order?.orderId || orderId,
      templateName: status,
      imageUrl: imageUrl,
      scheduledTime: scheduledTime
    };

    if (isTransactional) {
      await db.saveWhatsAppLog(log);
      logsSent.push(log);
      console.log(`[WhatsApp Queue] Transactional message queued for ${phone} (order ${orderId}). Will send at ${scheduledTime}`);
    } else {
      // Manual/On-demand message gets sent immediately
      console.log(`[WhatsApp] Dispatching manual notification to: ${phone}`);
      const result = await sendWhatsAppMessage(phone, primaryMessage, imageUrl);
      log.status = result.success ? 'Sent' : 'Failed';
      if (!result.success) {
        log.message = `${primaryMessage}\n\n❌ Error: ${result.error}`;
      }
      await db.saveWhatsAppLog(log);
      logsSent.push(log);
    }
  }

  return logsSent;
}

/**
 * Sends a secure Login Verification OTP code to a user via WhatsApp and logs the status.
 */
export async function sendLoginOTP(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const messageText = `🔐 Your 99Store login verification code is: ${otp}. It is valid for 5 minutes. Do not share this code with anyone.`;
  const result = await sendWhatsAppMessage(phone, messageText);

  const otpLog: WhatsAppLog = {
    id: `wa-otp-${Date.now()}`,
    timestamp: new Date().toISOString(),
    phone,
    type: 'Primary',
    message: result.success ? messageText : `${messageText}\n\n❌ Error: ${result.error}`,
    status: result.success ? 'Sent' : 'Failed'
  };

  await db.addWhatsAppLog(otpLog);
  return result;
}

let isQueueRunning = false;
let isQueueProcessing = false;

export function startQueueProcessor() {
  if (isQueueRunning) return;
  isQueueRunning = true;
  console.log('[WhatsApp Queue] Starting background queue processor...');
  
  setInterval(async () => {
    if (isQueueProcessing) {
      return;
    }
    isQueueProcessing = true;
    try {
      const logs = await db.getWhatsAppLogs();
      const now = Date.now();
      
      // Get all pending logs whose scheduledTime is due
      const pendingLogs = logs.filter(l => 
        l.status === 'Pending' && 
        l.scheduledTime && 
        new Date(l.scheduledTime).getTime() <= now
      );

      for (const log of pendingLogs) {
        // Enforce rate limiting: 1-minute interval between consecutive messages for the same orderId
        if (log.orderId) {
          const lastSentOrPending = logs.find(l => 
            l.orderId === log.orderId && 
            l.id !== log.id && 
            l.status === 'Sent' &&
            l.timestamp &&
            now - new Date(l.timestamp).getTime() < 60000
          );

          if (lastSentOrPending) {
            // Postpone this pending message by pushing its scheduledTime out by 1 minute from the last sent
            const newScheduled = new Date(new Date(lastSentOrPending.timestamp).getTime() + 60000).toISOString();
            log.scheduledTime = newScheduled;
            await db.saveWhatsAppLog(log);
            console.log(`[WhatsApp Queue] Postponing pending log ${log.id} for order ${log.orderId} due to rate limiting.`);
            continue;
          }
        }

        // Send the message
        console.log(`[WhatsApp Queue] Sending pending log ${log.id} for order ${log.orderId}...`);
        const result = await sendWhatsAppMessage(log.phone, log.message, log.imageUrl);
        
        log.status = result.success ? 'Sent' : 'Failed';
        if (!result.success) {
          log.message = `${log.message}\n\n❌ Error: ${result.error}`;
        }
        log.timestamp = new Date().toISOString(); // Update timestamp to actual send time
        await db.saveWhatsAppLog(log);
      }
    } catch (err) {
      console.error('[WhatsApp Queue] Error processing queue:', err);
    } finally {
      isQueueProcessing = false;
    }
  }, 10000); // Check every 10 seconds
}

// Auto-start the background queue processor server-side
if (typeof window === 'undefined') {
  startQueueProcessor();
}
