import { Order, SystemSettings, VelocityConfig } from '@/lib/types';
import { cleanCityName, cleanStateName } from '@/lib/courierHelper';
import { isCourierSimulationEnabled } from '@/lib/courierSimulation';
import { resolveConsigneePhone } from '@/lib/shipmentContact';

export function getVelocityBaseUrl(config?: VelocityConfig): string {
  if (config?.baseUrl && config.baseUrl.trim().length > 0) {
    return config.baseUrl.trim().replace(/\/+$/, '');
  }
  return 'https://shazam.velocity.in';
}

// In-memory token cache for session tokens (valid for 24h)
let cachedSessionToken: { token: string; expiresAt: number } | null = null;

export async function getVelocityAuthHeader(config?: VelocityConfig): Promise<string> {
  // 1. If long-lived API key is configured, use it directly
  const apiKey = (config?.apiKey || '').trim();
  if (apiKey) {
    return apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
  }

  // 2. Otherwise use username + password session auth token
  const username = (config?.username || '').trim();
  const password = (config?.password || '').trim();
  if (!username || !password) {
    return '';
  }

  const now = Date.now();
  if (cachedSessionToken && cachedSessionToken.expiresAt > now + 60000) {
    return cachedSessionToken.token;
  }

  const baseUrl = getVelocityBaseUrl(config);
  const res = await fetch(`${baseUrl}/custom/api/v1/auth-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Velocity auth token generation failed with HTTP ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  const token = data.token || data.payload?.token || data.data?.token;
  if (!token) {
    throw new Error('Velocity auth response did not contain a valid token');
  }

  // Default validity is 24 hours
  cachedSessionToken = {
    token,
    expiresAt: now + (23 * 60 * 60 * 1000),
  };

  return token;
}

export type VelocityServiceabilityResult = {
  serviceable: boolean | null;
  carriers?: Array<{ carrier_id: string; carrier_name: string }>;
  zone?: string;
  message?: string;
};

export async function checkVelocityServiceability(
  destinationPincode: string,
  config?: VelocityConfig,
  fromPincode?: string,
  paymentMode: 'cod' | 'prepaid' = 'cod',
): Promise<VelocityServiceabilityResult> {
  if (!destinationPincode || destinationPincode.length !== 6 || !/^\d{6}$/.test(destinationPincode)) {
    return { serviceable: false, message: 'Invalid destination pincode.' };
  }

  try {
    const authHeader = await getVelocityAuthHeader(config);
    if (!authHeader) {
      return { serviceable: null, message: 'Velocity credentials are not configured.' };
    }

    const baseUrl = getVelocityBaseUrl(config);
    const originPincode = fromPincode || config?.pickupPincode || '282007';

    const res = await fetch(`${baseUrl}/custom/api/v1/serviceability`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        from: originPincode,
        to: destinationPincode,
        payment_mode: paymentMode.toLowerCase(),
        shipment_type: 'forward',
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { serviceable: null, message: `Velocity serviceability HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json().catch(() => null);
    if (!data) {
      return { serviceable: null, message: 'Invalid JSON response from Velocity serviceability.' };
    }

    // Check status
    const statusStr = String(data?.status || '').toUpperCase();
    const isSuccessStatus = statusStr === 'SUCCESS' || data?.status === 1 || data?.success === true || data?.meta?.success === true;

    const carriers = data?.result?.serviceability_results
      || data?.payload?.serviceability_results
      || data?.data?.serviceability_results
      || data?.serviceability_results
      || [];

    if (isSuccessStatus) {
      const isServiceable = Array.isArray(carriers) && carriers.length > 0;
      return {
        serviceable: isServiceable,
        carriers,
        zone: data?.result?.zone || data?.zone,
        message: isServiceable ? undefined : `No serviceable carriers found for pincode ${destinationPincode}`,
      };
    }

    // If API returned an error message, check if it's explicitly about unserviceable pincode
    const msg = data.message || data.error || data?.meta?.message || '';
    if (/not serviceable|unserviceable|no service|invalid.*pin/i.test(msg)) {
      return {
        serviceable: false,
        carriers: [],
        message: msg || `Pincode ${destinationPincode} is not serviceable`,
      };
    }

    return {
      serviceable: null,
      message: msg || 'Velocity serviceability check returned non-success response.',
    };
  } catch (err: any) {
    return { serviceable: null, message: err.message };
  }
}

export function formatVelocityOrderDate(dateString?: string): string {
  const d = dateString ? new Date(dateString) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().replace('T', ' ').slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export async function bookVelocityOrder(
  order: Order,
  settings: SystemSettings,
  weightOverride?: number,
  phoneOverride?: string,
): Promise<{
  success: boolean;
  awb?: string;
  labelUrl?: string;
  eta?: string;
  courier?: string;
  charge?: number;
  error?: string;
  requestPayload?: any;
  responsePayload?: any;
}> {
  try {
    const config = settings.velocityConfig || { apiKey: '', priority: 5 };
    const apiKey = (config.apiKey || '').trim();
    const username = (config.username || '').trim();
    const isMock = (!apiKey && !username) || apiKey.startsWith('MOCK') || apiKey.includes('test') || apiKey.includes('dummy');

    // Consignee phone: MUST be resolved via resolveConsigneePhone to honor user's chosen contact!
    const cleanPhone = resolveConsigneePhone(order, phoneOverride);
    const weightInKg = weightOverride !== undefined ? weightOverride : (order.weight || 0.5);
    const isCod = order.paymentType === 'COD';
    const subTotal = Number(order.orderValue) || 990;
    const codCollectible = isCod ? (Number(order.finalPayableAmount ?? order.orderValue) || subTotal) : 0;

    // Split customer name
    const nameParts = (order.customerName || 'Customer').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || '.';

    const cleanCity = cleanCityName(order.area, order.state, order.pincode);
    const cleanState = cleanStateName(order.state, order.pincode);

    // Simulated booking fallback
    if (isMock) {
      if (!isCourierSimulationEnabled()) {
        return {
          success: false,
          error: 'Velocity credentials are missing or configured as placeholders. Courier simulation is disabled.',
          requestPayload: { orderId: order.orderId, shipmentPhone: cleanPhone },
        };
      }
      const randomAwbSuffix = Math.floor(100000000000 + Math.random() * 900000000000).toString();
      const awb = `VEL${randomAwbSuffix}`;
      const charge = 45 + weightInKg * 20 + (isCod ? 30 : 0);
      const etaDate = new Date();
      etaDate.setDate(etaDate.getDate() + 3);

      return {
        success: true,
        awb,
        eta: etaDate.toISOString().split('T')[0],
        courier: 'Velocity',
        charge: parseFloat(charge.toFixed(2)),
        labelUrl: `https://shazam.velocity.in/labels/${awb}.pdf`,
        requestPayload: { orderId: order.orderId, isMock: true, shipmentPhone: cleanPhone },
        responsePayload: { status: 1, message: 'Simulated Velocity Booking', payload: { awb_code: awb } },
      };
    }

    const authHeader = await getVelocityAuthHeader(config);
    if (!authHeader) {
      return {
        success: false,
        error: 'Velocity authorization failed: Missing API Key or Username/Password credentials.',
        requestPayload: { orderId: order.orderId, shipmentPhone: cleanPhone },
      };
    }

    const baseUrl = getVelocityBaseUrl(config);
    const warehouseId = config.warehouseId || 'WHUFWP';
    const pickupLocation = config.pickupLocationName || 'Shivay Ayurveda Agra';

    const orderItems = [
      {
        name: order.productDetails || '99Store Merchandise',
        sku: `SKU-${order.orderId.replace(/[^a-zA-Z0-9]/g, '')}`,
        units: 1,
        selling_price: subTotal,
        discount: 0,
        tax: 0,
      },
    ];

    const payload: any = {
      order_id: order.orderId,
      order_date: formatVelocityOrderDate(order.createdAt),
      carrier_id: '', // Leave blank for automated courier allocation based on velocity shipping rules
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: order.address || 'Address',
      billing_city: cleanCity,
      billing_pincode: order.pincode,
      billing_state: cleanState,
      billing_country: 'India',
      billing_email: 'support@99store.in',
      billing_phone: cleanPhone,
      shipping_is_billing: true,
      print_label: true,
      order_items: orderItems,
      payment_method: isCod ? 'COD' : 'PREPAID',
      sub_total: subTotal,
      cod_collectible: codCollectible,
      length: 10,
      breadth: 10,
      height: 10,
      weight: weightInKg,
      pickup_location: pickupLocation,
      warehouse_id: warehouseId,
    };

    // If vendor details are configured, add them
    if (config.pickupAddress || config.pickupCity || config.pickupPincode) {
      payload.vendor_details = {
        name: config.pickupContactPerson || pickupLocation,
        phone: config.pickupPhone || '9870740681',
        email: 'support@99store.in',
        address: config.pickupAddress || '',
        address_2: config.pickupAddress2 || '',
        city: config.pickupCity || '',
        state: config.pickupState || '',
        country: 'India',
        pin_code: config.pickupPincode || '',
        pickup_location: pickupLocation,
      };
    }

    const res = await fetch(`${baseUrl}/custom/api/v1/forward-order-orchestration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg =
        data?.meta?.details ||
        data?.meta?.message ||
        data?.message ||
        data?.error ||
        (data?.errors ? JSON.stringify(data.errors) : `HTTP ${res.status}`);
      return {
        success: false,
        error: `Velocity Booking Failed: ${errorMsg}`,
        requestPayload: payload,
        responsePayload: data || { status: res.status },
      };
    }

    if (data?.status === 1 && data?.payload?.awb_code) {
      const p = data.payload;
      const etaDate = new Date();
      etaDate.setDate(etaDate.getDate() + 3);

      const shippingCharge = parseFloat(p.charges?.frwd_charges?.shipping_charges || '0') +
                             parseFloat(p.charges?.frwd_charges?.cod_charges || '0');

      return {
        success: true,
        awb: p.awb_code,
        labelUrl: p.label_url || undefined,
        eta: etaDate.toISOString().split('T')[0],
        courier: 'Velocity',
        charge: shippingCharge > 0 ? parseFloat(shippingCharge.toFixed(2)) : undefined,
        requestPayload: payload,
        responsePayload: data,
      };
    }

    return {
      success: false,
      error: data?.message || data?.error || 'Velocity did not return an AWB code in payload.',
      requestPayload: payload,
      responsePayload: data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Velocity Booking Exception: ${err.message}`,
    };
  }
}

export async function trackVelocityOrder(
  waybill: string,
  config?: VelocityConfig,
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const authHeader = await getVelocityAuthHeader(config);
    if (!authHeader) {
      return { success: false, error: 'Velocity credentials are not configured.' };
    }

    const baseUrl = getVelocityBaseUrl(config);
    const res = await fetch(`${baseUrl}/custom/api/v1/order-tracking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ awbs: [waybill] }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `Velocity tracking HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function cancelVelocityOrder(
  waybills: string[],
  config?: VelocityConfig,
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const authHeader = await getVelocityAuthHeader(config);
    if (!authHeader) {
      return { success: false, error: 'Velocity credentials are not configured.' };
    }

    const baseUrl = getVelocityBaseUrl(config);
    const res = await fetch(`${baseUrl}/custom/api/v1/cancel-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ awbs: waybills }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { success: false, error: data?.message || `Velocity cancellation HTTP ${res.status}` };
    }

    return {
      success: true,
      message: data?.message || 'Bulk Shipment cancellation is in progress.',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
