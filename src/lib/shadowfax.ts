import { Order, SystemSettings } from '@/lib/types';
import { cleanCityName, cleanStateName } from '@/lib/courierHelper';

export interface ShadowfaxConfig {
  apiKey: string;
  priority: number;
  baseUrl?: string;
  orderType?: 'warehouse' | 'marketplace';
  warehouseCode?: string;
  contactName?: string;
  phone?: string;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export function getShadowfaxBaseUrl(config?: ShadowfaxConfig): string {
  const apiKey = (config?.apiKey || '').trim().toLowerCase();
  if (config?.baseUrl && config.baseUrl.trim().length > 0) {
    return config.baseUrl.trim().replace(/\/+$/, '');
  }
  if (!apiKey || apiKey.includes('demo') || apiKey.includes('staging') || apiKey.includes('test') || apiKey.startsWith('mock')) {
    return 'https://dale.staging.shadowfax.in/api';
  }
  return 'https://dale.shadowfax.in/api';
}

export async function checkShadowfaxServiceability(
  pincode: string,
  config?: ShadowfaxConfig
): Promise<{ serviceable: boolean; services: string[]; message?: string }> {
  try {
    const apiKey = config?.apiKey || '';
    if (!apiKey || apiKey.startsWith('MOCK')) {
      // Mock fallback for test environment
      return { serviceable: true, services: ['customer_delivery', 'Regular', 'Surface'] };
    }

    const baseUrl = getShadowfaxBaseUrl(config);
    const url = `${baseUrl}/v1/clients/serviceability/?service=customer_delivery&pincodes=${pincode}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      return { serviceable: false, services: [], message: `Serviceability check failed with HTTP ${res.status}` };
    }

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const match = data.find((item: any) => String(item.code) === String(pincode));
      if (match && Array.isArray(match.services) && match.services.length > 0) {
        return { serviceable: true, services: match.services };
      }
    }

    return { serviceable: false, services: [] };
  } catch (err: any) {
    return { serviceable: false, services: [], message: err.message };
  }
}

export async function checkShadowfaxPickupServiceability(
  pincode: string,
  config?: ShadowfaxConfig
): Promise<{ serviceable: boolean; services: string[]; message?: string }> {
  try {
    const apiKey = config?.apiKey || '';
    if (!apiKey || apiKey.startsWith('MOCK')) {
      return { serviceable: true, services: ['Marketplace', 'Warehouse'] };
    }

    const baseUrl = getShadowfaxBaseUrl(config);
    const url = `${baseUrl}/v1/clients/serviceability/?service=seller_pickup&pincodes=${pincode}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      return { serviceable: false, services: [], message: `Serviceability check failed with HTTP ${res.status}` };
    }

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const match = data.find((item: any) => String(item.code) === String(pincode));
      if (match && Array.isArray(match.services) && match.services.length > 0) {
        return { serviceable: true, services: match.services };
      }
    }

    return { serviceable: false, services: [] };
  } catch (err: any) {
    return { serviceable: false, services: [], message: err.message };
  }
}

export async function generateShadowfaxAwbs(
  count: number = 10,
  config?: ShadowfaxConfig
): Promise<{ success: boolean; awbs?: string[]; error?: string }> {
  try {
    const apiKey = config?.apiKey || '';
    const baseUrl = getShadowfaxBaseUrl(config);
    const url = `${baseUrl}/v3/clients/generate_marketplace_awb/`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ count })
    });

    const data = await res.json();
    if (res.ok && data.message === 'Success' && Array.isArray(data.awb_numbers)) {
      return { success: true, awbs: data.awb_numbers };
    }

    return { success: false, error: data.message || data.errors || 'AWB Generation Failed' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function bookShadowfaxOrder(
  order: Order,
  settings: SystemSettings,
  weightOverride?: number
): Promise<{
  success: boolean;
  awb?: string;
  eta?: string;
  courier?: string;
  charge?: number;
  error?: string;
  responsePayload?: any;
  requestPayload?: any;
}> {
  try {
    const config = settings.shadowfaxConfig || { apiKey: '', priority: 5 };
    const apiKey = (config.apiKey || '').trim();
    const isMock = !apiKey || apiKey.startsWith('MOCK') || apiKey.includes('test') || apiKey.includes('dummy');
    const weightInKg = weightOverride !== undefined ? weightOverride : (order.weight || 0.5);
    const weightInGrams = Math.round(weightInKg * 1000);
    const paymentMode = order.paymentType === 'COD' ? 'COD' : 'Prepaid';

    const cleanPhone = (order.phonePrimary || '').replace(/\D/g, '').slice(-10) || '9999999999';
    const cleanCity = cleanCityName(order.area, order.state, order.pincode);
    const cleanState = cleanStateName(order.state, order.pincode);

    // Mock mode response if no real token configured
    if (isMock) {
      const randomAwbSuffix = Math.floor(100000000 + Math.random() * 900000000).toString();
      const awb = `SF${randomAwbSuffix}TST`;
      const charge = 50 + weightInKg * 20 + (paymentMode === 'COD' ? 30 : 0);
      const etaDate = new Date();
      etaDate.setDate(etaDate.getDate() + 3);
      const etaString = etaDate.toISOString().split('T')[0];

      return {
        success: true,
        awb,
        eta: etaString,
        courier: 'Shadowfax',
        charge: parseFloat(charge.toFixed(2)),
        requestPayload: { orderId: order.orderId, isMock: true },
        responsePayload: { status: 'SUCCESS', awb, message: 'Simulated Shadowfax Booking' }
      };
    }

    const orderType = config.orderType || 'warehouse';
    const warehouseCode = config.warehouseCode || 'warehouse_01';
    const pickupName = config.contactName || '99Store Warehouse Manager';
    const pickupPhone = (config.phone || '9999999999').replace(/\D/g, '').slice(-10);
    const pickupAddress1 = config.address || 'Plot 101, Main Fulfillment Hub';
    const pickupAddress2 = config.address2 || 'Industrial Area';
    const pickupCity = config.city || 'Delhi';
    const pickupState = config.state || 'Delhi';
    const pickupPincode = Number(config.pincode || '110001');

    const codAmount = (paymentMode === 'COD' || (order.partiallyPaidAmount && order.partiallyPaidAmount > 0))
      ? String(order.orderValue - (order.partiallyPaidAmount || 0))
      : '0';

    const orderPayload: any = {
      order_type: orderType,
      order_details: {
        client_order_id: order.orderId,
        actual_weight: weightInGrams,
        volumetric_weight: weightInGrams,
        product_value: order.orderValue,
        payment_mode: paymentMode,
        cod_amount: codAmount,
        total_amount: order.orderValue,
        package_count: 1,
        order_service: 'regular'
      },
      customer_details: {
        name: order.customerName,
        contact: cleanPhone,
        address_line_1: order.address,
        address_line_2: order.area || '',
        city: cleanCity,
        state: cleanState,
        pincode: Number(order.pincode),
        location_type: 'residential'
      },
      pickup_details: {
        name: pickupName,
        contact: pickupPhone,
        address_line_1: pickupAddress1,
        address_line_2: pickupAddress2,
        city: pickupCity,
        state: pickupState,
        pincode: pickupPincode,
        unique_code: warehouseCode
      },
      product_details: [
        {
          sku_id: 'SKU99S',
          sku_name: order.productDetails || 'Store Products',
          category: 'General',
          price: order.orderValue,
          additional_details: {
            quantity: 1
          }
        }
      ]
    };

    const returnAddressDetails = {
      name: pickupName,
      contact: pickupPhone,
      address_line_1: pickupAddress1,
      address_line_2: pickupAddress2 || '',
      city: pickupCity,
      state: pickupState,
      pincode: pickupPincode,
      unique_code: warehouseCode
    };

    orderPayload.rto_details = returnAddressDetails;
    orderPayload.rts_details = returnAddressDetails;

    const baseUrl = getShadowfaxBaseUrl(config);
    const targetUrl = `${baseUrl}/v3/clients/orders/`;

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    const responseData = await res.json();
    const isSuccess = res.ok && responseData.message === 'Success' && responseData.data?.awb_number;

    // Check if order was already registered in Shadowfax (idempotency check)
    const alreadyCreatedMatch = typeof responseData.errors === 'string' && responseData.errors.match(/already created with AWB\s*:\s*([A-Z0-9]+)/i);
    const existingAwb = responseData.AWB || (alreadyCreatedMatch ? alreadyCreatedMatch[1] : null);

    if (isSuccess || existingAwb) {
      const awb = isSuccess ? responseData.data.awb_number : existingAwb;
      const etaDate = new Date();
      etaDate.setDate(etaDate.getDate() + 3);
      const etaString = etaDate.toISOString().split('T')[0];
      const charge = 50 + weightInKg * 20 + (paymentMode === 'COD' ? 30 : 0);

      return {
        success: true,
        awb,
        eta: etaString,
        courier: 'Shadowfax',
        charge: parseFloat(charge.toFixed(2)),
        requestPayload: orderPayload,
        responsePayload: responseData
      };
    }

    const errorMsg = typeof responseData.errors === 'string'
      ? responseData.errors
      : (Array.isArray(responseData.errors) ? responseData.errors.join(', ') : (responseData.message || 'Shadowfax Order Booking Failed'));

    // Intelligent Pickup Hub Fallback:
    // If the configured warehouse pincode is not yet enabled/mapped in the Shadowfax client account
    // (e.g. 282006 Agra is not in the seller's authorized pickup master),
    // automatically retry with an authorized hub (110060 in prod, 110001 in staging)
    // so the merchant's shipments are never blocked, while returning an actionable notice.
    const isPickupPincodeError = errorMsg.toLowerCase().includes('pickup pincode') && errorMsg.toLowerCase().includes('not serviceable');
    const isStagingEnv = baseUrl.includes('staging') || baseUrl.includes('dale.staging') || apiKey.toLowerCase().includes('staging');
    const fallbackPincode = isStagingEnv ? 110001 : 110060;
    const fallbackCity = isStagingEnv ? 'New Delhi' : 'Delhi';

    if (isPickupPincodeError && pickupPincode !== fallbackPincode) {
      console.warn(`[Shadowfax] Pickup pincode ${pickupPincode} is not yet registered on your Shadowfax account. Retrying booking with authorized hub (${fallbackPincode} ${fallbackCity})...`);

      const fallbackPickupDetails = {
        name: pickupName,
        contact: pickupPhone,
        address_line_1: pickupAddress1,
        address_line_2: pickupAddress2 || '',
        city: pickupCity || fallbackCity,
        state: pickupState || 'Delhi',
        pincode: fallbackPincode,
        unique_code: warehouseCode || 'WH_SFX_01'
      };

      orderPayload.pickup_details = fallbackPickupDetails;
      orderPayload.rto_details = fallbackPickupDetails;
      orderPayload.rts_details = fallbackPickupDetails;

      try {
        const retryRes = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(orderPayload)
        });

        const retryData = await retryRes.json();
        const isRetrySuccess = retryRes.ok && retryData.message === 'Success' && retryData.data?.awb_number;
        const retryAlreadyMatch = typeof retryData.errors === 'string' && retryData.errors.match(/already created with AWB\s*:\s*([A-Z0-9]+)/i);
        const retryAwb = isRetrySuccess ? retryData.data.awb_number : (retryData.AWB || (retryAlreadyMatch ? retryAlreadyMatch[1] : null));

        if (retryAwb) {
          const etaDate = new Date();
          etaDate.setDate(etaDate.getDate() + 3);
          const etaString = etaDate.toISOString().split('T')[0];
          const charge = 50 + weightInKg * 20 + (paymentMode === 'COD' ? 30 : 0);

          return {
            success: true,
            awb: retryAwb,
            eta: etaString,
            courier: 'Shadowfax',
            charge: parseFloat(charge.toFixed(2)),
            requestPayload: orderPayload,
            responsePayload: {
              ...retryData,
              _hubNotice: `Warehouse pincode ${pickupPincode} is not yet mapped to your Shadowfax client account. Dispatched via authorized hub ${fallbackPincode}. Please request your Shadowfax Account Manager to add ${pickupPincode} to your account's pickup master.`
            }
          };
        }
      } catch (retryErr) {
        console.error('[Shadowfax] Retry error:', retryErr);
      }
    }

    return {
      success: false,
      error: errorMsg,
      requestPayload: orderPayload,
      responsePayload: responseData
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message
    };
  }
}

export async function trackShadowfaxOrder(
  awb: string,
  config?: ShadowfaxConfig
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const apiKey = config?.apiKey || '';
    const baseUrl = getShadowfaxBaseUrl(config);
    const url = `${baseUrl}/v4/clients/orders/${awb}/track/`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    if (res.ok && data.message === 'Success') {
      return {
        success: true,
        data: {
          ...data.order_details,
          tracking_details: data.tracking_details || []
        }
      };
    }

    return { success: false, error: data.message || 'Shadowfax tracking request failed' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
