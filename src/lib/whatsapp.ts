import { db } from '@/lib/db';
import { WhatsAppLog } from '@/lib/types';

// MetaExperts WhatsApp API Credentials
const API_URL = 'https://metaexperts.in/api/send';
const INSTANCE_ID = '698EBE515A0E4';
const ACCESS_TOKEN = '685694fd67a5b';
const IMAGE_URL = 'https://i.postimg.cc/NjY3VRz6/WEBLOCKIN.png';

async function sendWhatsAppMessage(phone: string, messageText: string): Promise<{ success: boolean; error?: string }> {
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

    // 3. Make real fetch request to MetaExperts API
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: cleanPhone,
        type: 'text',
        message: messageText,
        instance_id: INSTANCE_ID,
        access_token: ACCESS_TOKEN,
      }),
    });

    const responseText = await res.text();
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${responseText || 'Unknown error'}` };
    }

    try {
      const data = JSON.parse(responseText);
      if (data.status && data.status.toLowerCase() === 'success') {
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
    paymentType
  } = params;

  const logsSent: WhatsAppLog[] = [];

  // --- 1. Primary Number Notifications ---
  let primaryMessage = '';
  switch (status) {
    case 'Created':
      primaryMessage = `🎉 Order Confirmed! Hi ${customerName}, your 99Store order #${orderId} of ₹${orderValue} has been successfully received. We will notify you once it's dispatched. Thank you for shopping with 99Store!`;
      break;
    case 'Dispatched':
      primaryMessage = `Hi ${customerName}, your 99Store order #${orderId} has been dispatched via ${courier || 'our shipping partner'}! Track your package using AWB: ${awb || 'N/A'}. ETA: ${eta || '3-4 Days'}. Thank you for shopping with 99Store!`;
      break;
    case 'OFD':
      primaryMessage = `🟢 Out for Delivery! Hi ${customerName}, your 99Store order #${orderId} is out for delivery today. Please keep your phone reachable. Courier AWB: ${awb || 'N/A'}.`;
      break;
    case 'Delivered':
      primaryMessage = `🎉 Delivered! Hi ${customerName}, your 99Store order #${orderId} has been successfully delivered. ${paymentType === 'COD' ? `COD Amount of ₹${orderValue} collected.` : 'Thank you for your prepaid payment!' } We hope you love your purchase!`;
      break;
    case 'NDR':
      primaryMessage = `⚠️ Delivery Failed! Hi ${customerName}, our courier partner was unable to deliver your 99Store order #${orderId}. Reason: Delivery attempt failed. Don't worry, we are scheduling a re-attempt shortly. Contact us if you wish to update details.`;
      break;
    case 'Return':
    case 'RDC':
      primaryMessage = `🔄 Return Update! Hi ${customerName}, your 99Store order #${orderId} has been marked for return (RDC/RTO). It is being shipped back to our fulfillment center. Please reach out to customer support to arrange a refund or reshipment.`;
      break;
    default:
      primaryMessage = `Hello ${customerName}, your 99Store order #${orderId} status has been updated to: ${status}.`;
      break;
  }

  const primaryResult = await sendWhatsAppMessage(phonePrimary, primaryMessage);

  const primaryLog: WhatsAppLog = {
    id: `wa-prim-${Date.now()}`,
    timestamp: new Date().toISOString(),
    phone: phonePrimary,
    type: 'Primary',
    message: primaryResult.success ? primaryMessage : `${primaryMessage}\n\n❌ Error: ${primaryResult.error}`,
    status: primaryResult.success ? 'Sent' : 'Failed'
  };
  await db.addWhatsAppLog(primaryLog);
  logsSent.push(primaryLog);

  // --- 2. Secondary Number Notifications ---
  if (phoneSecondary && phoneSecondary.trim() !== '') {
    let secondaryMessage = '';
    switch (status) {
      case 'Created':
        secondaryMessage = `Order Confirmed: Order #${orderId} is successfully received and preparing for packing. Alternate number alert.`;
        break;
      case 'Dispatched':
        secondaryMessage = `Tracking Update for #${orderId}: Package shipped via ${courier || 'partner'}. AWB: ${awb || 'N/A'}. Follow delivery status updates.`;
        break;
      case 'OFD':
        secondaryMessage = `Tracking Alert: Order #${orderId} is now OUT FOR DELIVERY (OFD). Courier: ${courier || 'partner'}. Estimated delivery: Today.`;
        break;
      case 'Delivered':
        secondaryMessage = `Delivery Complete: Order #${orderId} has been marked as DELIVERED. Alternate contact notification. Thank you!`;
        break;
      case 'NDR':
        secondaryMessage = `Tracking Alert: Delivery attempt failed for Order #${orderId}. Status set to NDR. Re-attempt will be scheduled.`;
        break;
      case 'Return':
      case 'RDC':
        secondaryMessage = `Tracking Alert: Order #${orderId} is returning to origin (RTO) - Return Delivery Center.`;
        break;
      default:
        secondaryMessage = `Tracking Update: Order #${orderId} is now in state: ${status}.`;
        break;
    }

    const secondaryResult = await sendWhatsAppMessage(phoneSecondary, secondaryMessage);

    const secondaryLog: WhatsAppLog = {
      id: `wa-sec-${Date.now()}`,
      timestamp: new Date().toISOString(),
      phone: phoneSecondary,
      type: 'Secondary',
      message: secondaryResult.success ? secondaryMessage : `${secondaryMessage}\n\n❌ Error: ${secondaryResult.error}`,
      status: secondaryResult.success ? 'Sent' : 'Failed'
    };
    await db.addWhatsAppLog(secondaryLog);
    logsSent.push(secondaryLog);
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
