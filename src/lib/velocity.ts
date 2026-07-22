import { Order, SystemSettings } from './types';

// In-memory token cache for Velocity
const velocityTokenCache: Record<string, { token: string; expiresAt: number }> = {};

/**
 * Resolves active Velocity credentials and endpoints.
 */
export function resolveVelocityConfig(settings: SystemSettings) {
  const config = settings.velocityConfig || {};
  return {
    username: config.username || 'shivaynew66@gmail.com',
    password: config.password || 'Som@9870740681',
    baseUrl: (config.baseUrl || 'https://shazam.velocity.in/').replace(/\/$/, ''),
    warehouseId: config.warehouseId || 'WH66DU',
    warehouseName: config.warehouseName || 'Main Warehouse',
    contactName: config.contactName || 'Shivay Manager',
    phone: config.phone || '9870740681',
    address: config.address || '123 Velocity St',
    city: config.city || 'Agra',
    state: config.state || 'Uttar Pradesh',
    pincode: config.pincode || '282001'
  };
}

/**
 * Retrieves the Velocity API auth token (cached).
 */
export async function getVelocityToken(config: any): Promise<string> {
  const username = config.username;
  const password = config.password;
  const baseUrl = config.baseUrl;

  // Simulation mode fallback
  if (!username || !password || username.includes('example.com') || username.startsWith('your-') || username.includes('mock')) {
    return 'MOCK_VELOCITY_TOKEN_12345';
  }

  // Check cache
  const cached = velocityTokenCache[username];
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  try {
    const res = await fetch(`${baseUrl}/custom/api/v1/auth-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      throw new Error(`Velocity auth token failed with HTTP status ${res.status}`);
    }

    const data = await res.json();
    if (!data.token) {
      throw new Error(`Invalid authentication response: ${JSON.stringify(data)}`);
    }

    // Cache the token for 23 hours (Velocity token valid for 24 hours)
    velocityTokenCache[username] = {
      token: data.token,
      expiresAt: Date.now() + 23 * 60 * 60 * 1000
    };

    return data.token;
  } catch (err: any) {
    console.error('Velocity Auth Token Retrieval Error:', err);
    throw err;
  }
}

/**
 * Books/Manifests a forward shipment via Velocity API.
 */
export async function bookVelocityOrder(
  order: Order,
  settings: SystemSettings,
  weight?: number,
  paymentType?: string
): Promise<{ success: boolean; awb: string; eta: string; label_url: string; shipment_id: string; courier: string; charge: number }> {
  const config = resolveVelocityConfig(settings);
  const token = await getVelocityToken(config);
  
  const isMock = token === 'MOCK_VELOCITY_TOKEN_12345';
  const finalWeight = weight || order.weight || 0.2;
  const finalPaymentType = paymentType || order.paymentType || 'COD';

  if (isMock) {
    // Generate simulated booking details
    const randomAwb = `VEL${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const etaDate = new Date();
    etaDate.setDate(etaDate.getDate() + 3);
    const etaString = etaDate.toISOString().split('T')[0];
    const charge = 50 + finalWeight * 30 + (finalPaymentType === 'COD' ? 30 : 0);
    const mockLabel = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
    const mockShipmentId = `SHI${Math.floor(100000 + Math.random() * 900000)}VEL`;

    return {
      success: true,
      awb: randomAwb,
      eta: etaString,
      label_url: mockLabel,
      shipment_id: mockShipmentId,
      courier: 'Velocity',
      charge
    };
  }

  // Format order date: YYYY-MM-DD HH:mm (using current time)
  const now = new Date();
  const formatDigit = (d: number) => d < 10 ? `0${d}` : d;
  const orderDateStr = `${now.getFullYear()}-${formatDigit(now.getMonth() + 1)}-${formatDigit(now.getDate())} ${formatDigit(now.getHours())}:${formatDigit(now.getMinutes())}`;

  // Velocity forward order orchestration request body
  const payload = {
    order_id: order.orderId,
    order_date: orderDateStr,
    carrier_id: '', // Leave blank for auto assignment by Velocity
    billing_customer_name: order.customerName,
    billing_last_name: '',
    billing_address: order.address,
    billing_city: order.area || 'Agra',
    billing_pincode: order.pincode,
    billing_state: order.state || 'Uttar Pradesh',
    billing_country: 'India',
    billing_phone: order.phonePrimary,
    billing_email: order.phonePrimary + '@velocity-user.com',
    shipping_is_billing: true,
    print_label: true,
    order_items: [
      {
        name: order.productDetails || '99Store Order Item',
        sku: 'SKU-001',
        units: 1,
        selling_price: order.orderValue,
        discount: 0,
        tax: 0
      }
    ],
    payment_method: finalPaymentType === 'COD' ? 'COD' : 'PREPAID',
    sub_total: order.orderValue,
    cod_collectible: finalPaymentType === 'COD' ? (order.orderValue - (order.partiallyPaidAmount || 0)) : 0,
    length: 10,
    breadth: 10,
    height: 10,
    weight: finalWeight,
    pickup_location: config.warehouseName,
    warehouse_id: config.warehouseId
  };

  try {
    const res = await fetch(`${config.baseUrl}/custom/api/v1/forward-order-orchestration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Velocity booking failed with HTTP status ${res.status}: ${errorText}`);
    }

    const responseData = await res.json();
    
    // According to docs, success is indicated by status: 1 or status: "SUCCESS"
    const isSuccess = responseData.status === 1 || responseData.status === 'SUCCESS' || responseData.status === '1';
    
    if (!isSuccess || !responseData.payload) {
      throw new Error(responseData.message || responseData.error || `Velocity API error: ${JSON.stringify(responseData)}`);
    }

    const payloadData = responseData.payload;
    const awb = payloadData.awb_code || '';
    const label_url = payloadData.label_url || '';
    const shipment_id = payloadData.shipment_id || '';
    const assignedCourierName = payloadData.courier_name || 'Velocity Assigned Partner';
    
    // Parse charges
    let charge = 60; // fallback default
    if (payloadData.charges && payloadData.charges.frwd_charges) {
      const shippingCharges = parseFloat(payloadData.charges.frwd_charges.shipping_charges || '0');
      const codCharges = parseFloat(payloadData.charges.frwd_charges.cod_charges || '0');
      charge = shippingCharges + codCharges;
    }

    const etaDays = 3;
    const etaDate = new Date();
    etaDate.setDate(etaDate.getDate() + etaDays);
    const etaString = etaDate.toISOString().split('T')[0];

    return {
      success: true,
      awb,
      eta: etaString,
      label_url,
      shipment_id,
      courier: `Velocity (${assignedCourierName})`,
      charge
    };
  } catch (err: any) {
    console.error('Velocity Booking API Exception:', err);
    throw err;
  }
}

/**
 * Tracks a shipment via Velocity Order Tracking API.
 */
export async function trackVelocityShipment(
  waybill: string,
  settings: SystemSettings
): Promise<any> {
  const config = resolveVelocityConfig(settings);
  const token = await getVelocityToken(config);
  const isMock = token === 'MOCK_VELOCITY_TOKEN_12345';

  if (isMock) {
    // Return unified tracking mock data
    return {
      ShipmentData: [
        {
          Shipment: {
            AWB: waybill,
            Consignee: { Name: "Simulated Velocity Recipient" },
            Status: {
              Status: "Out for Delivery",
              StatusLocation: "Agra Hub",
              StatusDateTime: new Date().toISOString()
            },
            Scans: [
              {
                ScanDetail: {
                  Scan: "Out for Delivery",
                  ScanDateTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
                  ScannedLocation: "Agra Delivery Center",
                  Instructions: "Courier agent assigned for doorstep delivery."
                }
              },
              {
                ScanDetail: {
                  Scan: "In Transit",
                  ScanDateTime: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
                  ScannedLocation: "Lucknow Gateway Hub",
                  Instructions: "Departed from facility hub."
                }
              },
              {
                ScanDetail: {
                  Scan: "Manifest Uploaded",
                  ScanDateTime: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
                  ScannedLocation: "Delhi Warehouse",
                  Instructions: "Order manifested via Velocity Aggregator."
                }
              }
            ]
          }
        }
      ]
    };
  }

  try {
    const res = await fetch(`${config.baseUrl}/custom/api/v1/order-tracking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ awbs: [waybill] })
    });

    if (!res.ok) {
      throw new Error(`Velocity tracking failed with HTTP status ${res.status}`);
    }

    const data = await res.json();
    
    // Map Velocity tracking structure to unified Delhivery format
    const velocityResult = data?.result?.[waybill] || data?.payload?.[waybill];
    if (!velocityResult || !velocityResult.tracking_data) {
      throw new Error(`No tracking data found for waybill ${waybill} in Velocity response.`);
    }

    const trackingData = velocityResult.tracking_data;
    const currentStatus = trackingData.shipment_status || 'In Transit';
    const destination = trackingData.destination || 'Destination Hub';

    const rawActivities = trackingData.shipment_track_activities || [];
    const scans = rawActivities.map((act: any) => ({
      ScanDetail: {
        ScannedLocation: act.location || 'Hub',
        ScanDateTime: act.date ? new Date(act.date).toISOString() : new Date().toISOString(),
        Scan: act.activity || 'Scan Recorded',
        Instructions: act.activity || ''
      }
    }));

    const unifiedResponse = {
      ShipmentData: [
        {
          Shipment: {
            AWB: waybill,
            Status: {
              Status: currentStatus,
              StatusLocation: destination,
              StatusDateTime: new Date().toISOString()
            },
            Scans: scans.length > 0 ? scans : [
              {
                ScanDetail: {
                  Scan: currentStatus,
                  ScanDateTime: new Date().toISOString(),
                  ScannedLocation: destination,
                  Instructions: 'No scan history details returned.'
                }
              }
            ]
          }
        }
      ]
    };

    return unifiedResponse;
  } catch (err: any) {
    console.error('Velocity Tracking API Exception:', err);
    throw err;
  }
}

/**
 * Cancels a shipment via Velocity Cancel Order API.
 */
export async function cancelVelocityShipment(
  waybill: string,
  settings: SystemSettings
): Promise<any> {
  const config = resolveVelocityConfig(settings);
  const token = await getVelocityToken(config);
  const isMock = token === 'MOCK_VELOCITY_TOKEN_12345';

  if (isMock) {
    return {
      success: true,
      message: 'Shipment cancellation simulated successfully.'
    };
  }

  try {
    const res = await fetch(`${config.baseUrl}/custom/api/v1/cancel-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ awbs: [waybill] })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Velocity cancel failed with HTTP status ${res.status}: ${text}`);
    }

    const data = await res.json();
    return {
      success: true,
      message: data.message || 'Velocity cancellation request received.'
    };
  } catch (err: any) {
    console.error('Velocity Cancel API Exception:', err);
    throw err;
  }
}
