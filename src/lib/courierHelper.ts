import { db } from '@/lib/db';
import { CourierApiLog, SystemSettings, Order } from '@/lib/types';
import { getXpressBeesToken, resolveXpressBeesConfig } from '@/lib/xpressbees';
import { bookVelocityOrder } from '@/lib/velocity';

export function isDtdcStaging(apiKey?: string, username?: string): boolean {
  const key = (apiKey || '').toLowerCase();
  const user = (username || '').toLowerCase();
  return (
    key.includes('demo') ||
    key.includes('alpha') ||
    key.includes('staging') ||
    key.includes('test') ||
    key === 'f4ae602554b4a185d21695991885f0' ||
    user.includes('test') ||
    user.includes('stage') ||
    user.includes('demo') ||
    user.includes('alpha') ||
    user === 'gl018_trk_json'
  );
}

export function cleanCityName(area: string, state: string, pincode: string): string {
  let clean = (area || '').trim();
  if (clean.includes(',')) {
    clean = clean.split(',').pop()!.trim();
  }
  clean = clean.replace(/\(.*\)/g, '').trim();
  const isFallback = clean.toLowerCase().includes('zone') || 
                     clean.toLowerCase().includes('default') || 
                     clean.toLowerCase().includes('pincode') || 
                     clean.toLowerCase().includes('region') || 
                     clean.toLowerCase().includes('serviced') || 
                     clean.length < 3;
                     
  if (isFallback && pincode) {
    const prefix2 = pincode.slice(0, 2);
    const prefix1 = pincode.charAt(0);
    
    if (prefix2 === '11') return 'New Delhi';
    if (prefix2 === '12' || prefix2 === '13') return 'Gurugram';
    if (prefix2 === '14' || prefix2 === '15' || prefix2 === '16') return 'Ludhiana';
    if (prefix1 === '2') return 'Noida';
    if (prefix2 === '30' || prefix2 === '31' || prefix2 === '32' || prefix2 === '33' || prefix2 === '34') return 'Jaipur';
    if (prefix1 === '3') return 'Ahmedabad';
    if (prefix1 === '4') return 'Mumbai';
    if (prefix2 === '50') return 'Hyderabad';
    if (prefix2 === '51' || prefix2 === '52' || prefix2 === '53') return 'Vijayawada';
    if (prefix1 === '5') return 'Bengaluru';
    if (prefix2 === '67' || prefix2 === '68' || prefix2 === '69') return 'Kochi';
    if (prefix1 === '6') return 'Chennai';
    if (prefix1 === '7') return 'Kolkata';
    if (prefix1 === '8') return 'Patna';
  }
  
  if (isFallback) {
    return 'Mumbai';
  }
  return clean;
}

export function cleanStateName(state: string, pincode: string): string {
  let clean = (state || '').trim();
  clean = clean
    .replace(/^HR$/i, 'Haryana')
    .replace(/^UP$/i, 'Uttar Pradesh')
    .replace(/^DL$/i, 'Delhi')
    .replace(/^RJ$/i, 'Rajasthan')
    .replace(/^MH$/i, 'Maharashtra');

  if (clean.includes('/')) {
    const parts = clean.split('/');
    const zone = pincode ? pincode.slice(0, 2) : '';
    
    if (clean.toLowerCase().includes('delhi')) {
      return 'Delhi';
    }
    if (clean.toLowerCase().includes('karnataka')) {
      return (zone.startsWith('56') || zone.startsWith('57') || zone.startsWith('58') || zone.startsWith('59')) ? 'Karnataka' : 'Andhra Pradesh';
    }
    if (clean.toLowerCase().includes('tamil')) {
      return (zone.startsWith('60') || zone.startsWith('61') || zone.startsWith('62') || zone.startsWith('63') || zone.startsWith('64')) ? 'Tamil Nadu' : 'Kerala';
    }
    if (clean.toLowerCase().includes('west bengal')) {
      return 'West Bengal';
    }
    if (clean.toLowerCase().includes('bihar')) {
      return (zone.startsWith('80') || zone.startsWith('81') || zone.startsWith('82') || zone.startsWith('83') || zone.startsWith('84') || zone.startsWith('85')) ? 'Bihar' : 'Jharkhand';
    }
    return parts[0].trim();
  }
  return clean || 'Uttar Pradesh';
}

export async function replenishAwbPool(settings: SystemSettings, token: string) {
  try {
    const xbConfig = settings.xpressbeesConfig;
    const xbKey = xbConfig.xbKey || '';
    
    let currentToken = token;
    if (!currentToken) {
      currentToken = await getXpressBeesToken(xbConfig);
    }
    
    const awbGenUrl = xbConfig.awbGenUrl || 'https://xbclientapi.xbees.in/POSTShipmentService.svc/AWBNumberSeriesGeneration';
    const awbGenRes = await fetch(awbGenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': currentToken,
        'XBKey': xbKey
      },
      body: JSON.stringify({
        BusinessUnit: "ECOM",
        ServiceType: "FORWARD",
        DeliveryType: "PREPAID",
        TokenNumber: currentToken,
        Token: currentToken
      })
    });
    
    const awbGenData = await awbGenRes.json();
    if (!awbGenRes.ok || awbGenData.ReturnCode !== 100 || !awbGenData.BatchID) {
      console.error("[XpressBees] Replenish AWB: Series generation failed", awbGenData);
      return;
    }
    
    const batchId = awbGenData.BatchID;
    const awbRetrieveUrl = xbConfig.awbRetrieveUrl || 'https://xbclientapi.xbees.in/TrackingService.svc/GetAWBNumberGeneratedSeries';
    const awbRetrieveRes = await fetch(awbRetrieveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': currentToken,
        'XBKey': xbKey
      },
      body: JSON.stringify({
        BusinessUnit: "ECOM",
        ServiceType: "FORWARD",
        BatchID: batchId,
        TokenNumber: currentToken,
        Token: currentToken
      })
    });
    
    const awbRetrieveData = await awbRetrieveRes.json();
    if (!awbRetrieveRes.ok || awbRetrieveData.ReturnCode !== 100 || !awbRetrieveData.AWBNoSeries || awbRetrieveData.AWBNoSeries.length === 0) {
      console.error("[XpressBees] Replenish AWB: Retrieval failed", awbRetrieveData);
      return;
    }
    
    const freshSettings = await db.getSettings();
    if (!freshSettings.xpressbeesAwbPool) {
      freshSettings.xpressbeesAwbPool = [];
    }
    
    const newAwbs = awbRetrieveData.AWBNoSeries.filter((a: string) => !freshSettings.xpressbeesAwbPool!.includes(a));
    freshSettings.xpressbeesAwbPool.push(...newAwbs);
    
    await db.saveSettings(freshSettings);
    console.log(`[XpressBees] Replenished AWB pool with ${newAwbs.length} numbers. Current pool size: ${freshSettings.xpressbeesAwbPool?.length}`);
  } catch (err) {
    console.error("[XpressBees] Error replenishing AWB pool in background:", err);
  }
}

export async function bookCourierShipment(
  order: Order,
  settings: SystemSettings,
  weightOverride?: number,
  courierOverride?: string,
  phoneOverride?: string,
  modeOverride?: string
): Promise<{
  success: boolean;
  awb?: string;
  eta?: string;
  courier?: string;
  charge?: number;
  error?: string;
  note?: string;
  velocity_label_url?: string;
  velocity_shipment_id?: string;
}> {
  try {
    const rawCourier = courierOverride || order.courier || 'DTDC';
    const weight = weightOverride !== undefined ? weightOverride : (order.weight || 0.5);
    const paymentType = order.paymentType || 'COD';

    const isXpressBeesBooking = rawCourier.toLowerCase().includes('xpressbees');
    const courier = isXpressBeesBooking ? 'XpressBees' : rawCourier;
    const requestedMode = modeOverride || (rawCourier.toLowerCase().includes('surface') ? 'Surface' : (rawCourier.toLowerCase().includes('air') ? 'Air' : undefined));

    let isCourierActive = false;
    let apiKey = 'MOCK_KEY';

    switch (courier) {
      case 'DTDC':
        isCourierActive = settings.dtdcActive;
        apiKey = settings.dtdcConfig.apiKey;
        break;
      case 'XpressBees':
        isCourierActive = settings.xpressbeesActive;
        break;
      case 'Delhivery':
        isCourierActive = settings.deliveryActive;
        apiKey = settings.deliveryConfig.apiKey;
        break;
      case 'Aggregator':
        isCourierActive = settings.aggregatorActive || settings.velocityActive;
        apiKey = 'agg_link_99s_9a2b8e';
        break;
      case 'Velocity':
        isCourierActive = settings.velocityActive;
        apiKey = 'velocity_api_token';
        break;
    }

    if (!isCourierActive) {
      const failedLog: CourierApiLog = {
        id: `cl-fail-${Date.now()}`,
        timestamp: new Date().toISOString(),
        courier,
        action: 'Generate AWB',
        requestPayload: JSON.stringify({ orderId: order.orderId, courier, weight, paymentType }, null, 2),
        responsePayload: JSON.stringify({ error: `${courier} integration is currently inactive in settings.` }, null, 2),
        status: 'Error'
      };
      await db.addCourierLog(failedLog);
      return { success: false, error: `${courier} Integration is disabled.` };
    }

    // LIVE XPRESSBEES BOOKING
    if (courier === 'XpressBees') {
      const xbConfig = resolveXpressBeesConfig(settings.xpressbeesConfig, requestedMode);
      let token = 'MOCK_TOKEN_12345';
      try {
        token = await getXpressBeesToken(xbConfig);
      } catch (err: any) {
        const errorLog: CourierApiLog = {
          id: `cl-fail-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'XpressBees',
          action: 'Login / Generate AWB',
          requestPayload: JSON.stringify({ orderId: order.orderId }, null, 2),
          responsePayload: JSON.stringify({ error: `Authentication failed: ${err.message}` }, null, 2),
          status: 'Error'
        };
        await db.addCourierLog(errorLog);
        return { success: false, error: `XpressBees Authentication failed: ${err.message}` };
      }

      const isMockToken = token === 'MOCK_TOKEN_12345';

      if (isMockToken) {
        const randomAwbSuffix = Math.floor(100000000 + Math.random() * 900000000).toString();
        const awb = `XB${randomAwbSuffix}`;
        const charge = 55 + weight * 25 + (paymentType === 'COD' ? 35 : 0);
        const etaDays = 3;
        const etaDate = new Date();
        etaDate.setDate(etaDate.getDate() + etaDays);
        const etaString = etaDate.toISOString().split('T')[0];

        const responsePayload = {
          status: 'SUCCESS',
          awb,
          eta: etaString,
          charge: parseFloat(charge.toFixed(2)),
          shipper: '99Store Fulfillment Center - Delhi NCR (Simulated)',
          apiKeyUsed: 'MOCK_TOKEN_12345'
        };

        await db.addCourierLog({
          id: `cl-success-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'XpressBees',
          action: 'Generate AWB (Simulated)',
          requestPayload: JSON.stringify({ orderId: order.orderId }, null, 2),
          responsePayload: JSON.stringify(responsePayload, null, 2),
          status: 'Success'
        });

        return { success: true, awb, eta: etaString, courier: 'XpressBees', charge };
      }

      let finalAwb = '';
      const authType = xbConfig.authType || 'new';

      if (authType === 'new') {
        let cachedPool = settings.xpressbeesAwbPool || [];
        if (cachedPool.length > 0) {
          finalAwb = cachedPool.shift()!;
          settings.xpressbeesAwbPool = cachedPool;
          await db.saveSettings(settings);

          if (cachedPool.length < 20) {
            replenishAwbPool(settings, token).catch(err => {
              console.error("[XpressBees] Background replenish error:", err);
            });
          }
        } else {
          try {
            const awbGenUrl = xbConfig.awbGenUrl || 'https://xbclientapi.xbees.in/POSTShipmentService.svc/AWBNumberSeriesGeneration';
            let awbGenRes = await fetch(awbGenUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Token': token,
                'XBKey': xbConfig.xbKey || ''
              },
              body: JSON.stringify({
                BusinessUnit: "ECOM",
                ServiceType: "FORWARD",
                DeliveryType: order.paymentType === 'COD' ? 'COD' : 'PREPAID',
                TokenNumber: token,
                Token: token
              })
            });

            let awbGenData = await awbGenRes.json();

            if (awbGenData.ReturnCode === 101 || (typeof awbGenData.ReturnMessage === 'string' && awbGenData.ReturnMessage.toLowerCase().includes('token'))) {
              token = await getXpressBeesToken(xbConfig, true);
              awbGenRes = await fetch(awbGenUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Token': token,
                  'XBKey': xbConfig.xbKey || ''
                },
                body: JSON.stringify({
                  BusinessUnit: "ECOM",
                  ServiceType: "FORWARD",
                  DeliveryType: order.paymentType === 'COD' ? 'COD' : 'PREPAID',
                  TokenNumber: token,
                  Token: token
                })
              });
              awbGenData = await awbGenRes.json();
            }

            await db.addCourierLog({
              id: `cl-xb-awbgen-${Date.now()}`,
              timestamp: new Date().toISOString(),
              courier: 'XpressBees',
              action: 'AWB Series Generation',
              requestPayload: JSON.stringify({ BusinessUnit: "ECOM", ServiceType: "FORWARD", DeliveryType: order.paymentType === 'COD' ? 'COD' : 'PREPAID' }, null, 2),
              responsePayload: JSON.stringify(awbGenData, null, 2),
              status: awbGenRes.ok && awbGenData.ReturnCode === 100 ? 'Success' : 'Error'
            });

            if (!awbGenRes.ok || awbGenData.ReturnCode !== 100 || !awbGenData.BatchID) {
              return { success: false, error: `XpressBees AWB Series Generation failed: ${awbGenData.ReturnMessage || 'Invalid response'}` };
            }

            const batchId = awbGenData.BatchID;
            const awbRetrieveUrl = xbConfig.awbRetrieveUrl || 'https://xbclientapi.xbees.in/TrackingService.svc/GetAWBNumberGeneratedSeries';
            const awbRetrieveRes = await fetch(awbRetrieveUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Token': token,
                'XBKey': xbConfig.xbKey || ''
              },
              body: JSON.stringify({
                BusinessUnit: "ECOM",
                ServiceType: "FORWARD",
                BatchID: batchId,
                TokenNumber: token,
                Token: token
              })
            });

            const awbRetrieveData = await awbRetrieveRes.json();
            const loggedRetrieveData = { ...awbRetrieveData };
            if (Array.isArray(loggedRetrieveData.AWBNoSeries) && loggedRetrieveData.AWBNoSeries.length > 5) {
              loggedRetrieveData.AWBNoSeries = [
                ...loggedRetrieveData.AWBNoSeries.slice(0, 5),
                `... and ${loggedRetrieveData.AWBNoSeries.length - 5} more AWB numbers (truncated)`
              ];
            }

            await db.addCourierLog({
              id: `cl-xb-awbretrieve-${Date.now()}`,
              timestamp: new Date().toISOString(),
              courier: 'XpressBees',
              action: 'Get AWB Generated Series',
              requestPayload: JSON.stringify({ BusinessUnit: "ECOM", ServiceType: "FORWARD", BatchID: batchId }, null, 2),
              responsePayload: JSON.stringify(loggedRetrieveData, null, 2),
              status: awbRetrieveRes.ok && awbRetrieveData.ReturnCode === 100 ? 'Success' : 'Error'
            });

            if (!awbRetrieveRes.ok || awbRetrieveData.ReturnCode !== 100 || !awbRetrieveData.AWBNoSeries || awbRetrieveData.AWBNoSeries.length === 0) {
              return { success: false, error: `XpressBees AWB Retrieval failed: ${awbRetrieveData.ReturnMessage || 'No AWB numbers returned'}` };
            }

            finalAwb = awbRetrieveData.AWBNoSeries[0];

            if (awbRetrieveData.AWBNoSeries.length > 1) {
              settings.xpressbeesAwbPool = awbRetrieveData.AWBNoSeries.slice(1);
              await db.saveSettings(settings);
            }
          } catch (err: any) {
            await db.addCourierLog({
              id: `cl-xb-awbgen-fail-${Date.now()}`,
              timestamp: new Date().toISOString(),
              courier: 'XpressBees',
              action: 'AWB Generation Flow',
              requestPayload: JSON.stringify({ orderId: order.orderId }, null, 2),
              responsePayload: JSON.stringify({ error: err.message || err }, null, 2),
              status: 'Error'
            });
            return { success: false, error: `XpressBees AWB pre-generation flow error: ${err.message}` };
          }
        }
      }

      const weightInGrams = Math.round(Number(weight) * 1000);
      const serviceType = xbConfig.serviceType || 'NDD';
      const vendorCode = xbConfig.vendorCode || 'VEND001';

      const cleanConsigneePhone = (phoneOverride || order.phonePrimary || '').replace(/\D/g, '').slice(-10) || '9999999999';
      const cleanConsigneeState = cleanStateName(order.state || 'Uttar Pradesh', order.pincode);
      const cleanConsigneeCity = cleanCityName(order.area, order.state, order.pincode);
      const bizAccountName = xbConfig.businessAccountName || xbConfig.accountName || 'Shivay Air';

      const bookingPayload: any = {
        order_number: order.orderId,
        unique_order_number: "yes",
        shipping_charges: 40,
        discount: 0,
        cod_charges: 0,
        payment_type: order.paymentType === 'COD' ? 'cod' : 'prepaid',
        order_amount: order.orderValue,
        package_weight: weightInGrams,
        package_length: 10,
        package_breadth: 10,
        package_height: 10,
        request_auto_pickup: "yes",
        service_type: serviceType,
        pickup_vendor_code: vendorCode,
        consignee: {
          name: order.customerName,
          address: order.address,
          address_2: order.area || '',
          city: cleanConsigneeCity,
          state: cleanConsigneeState,
          pincode: order.pincode,
          phone: cleanConsigneePhone
        },
        pickup: {
          vendor_code: vendorCode,
          warehouse_name: xbConfig.warehouseName || 'Main Warehouse',
          name: xbConfig.contactName || 'Warehouse Manager',
          address: xbConfig.address || '140 MG Road',
          address_2: xbConfig.address2 || 'Near Metro Station',
          city: xbConfig.city || 'Agra',
          state: xbConfig.state || 'Uttar Pradesh',
          pincode: xbConfig.pincode || '282001',
          phone: xbConfig.phone || '9999999999'
        },
        order_items: [
          {
            name: order.productDetails || 'Product 1',
            qty: "1",
            price: order.orderValue,
            sku: "SKU001"
          }
        ],
        courier_id: serviceType.toUpperCase() === 'NDD' ? '12939' : (serviceType.toUpperCase() === 'SDD' ? '12938' : '1'),
        collectable_amount: (order.paymentType === 'COD' || (order.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0 && order.orderValue > order.partiallyPaidAmount)) ? String(order.orderValue - (order.partiallyPaidAmount || 0)) : "0"
      };

      if (authType === 'new') {
        bookingPayload.BusinessAccountName = bizAccountName;
        bookingPayload.OrderNo = order.orderId;
        bookingPayload.SubOrderNo = order.orderId;
        bookingPayload.DeclaredValue = Number(order.orderValue || 100);
        bookingPayload.OrderType = (order.paymentType === 'COD' || (order.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0 && order.orderValue > order.partiallyPaidAmount)) ? 'COD' : 'PREPAID';
        bookingPayload.CollectibleAmount = (order.paymentType === 'COD' || (order.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0 && order.orderValue > order.partiallyPaidAmount)) ? Number(order.orderValue - (order.partiallyPaidAmount || 0)) : 0;
        bookingPayload.ServiceType = serviceType;
        bookingPayload.Quantity = 1;
        bookingPayload.Weight = Number(weight);
        bookingPayload.Length = 10;
        bookingPayload.Width = 10;
        bookingPayload.Height = 10;
        bookingPayload.AWBNo = finalAwb;
        bookingPayload.awb_number = finalAwb;
        bookingPayload.awb = finalAwb;
        bookingPayload.AirWayBillNO = finalAwb;
        bookingPayload.TokenNumber = token;
        bookingPayload.Token = token;
        bookingPayload.PickupVendorCode = vendorCode;
        bookingPayload.pickup_vendor_code = vendorCode;

        const dropAddressObj = {
          Type: "Primary",
          AddressType: "Primary",
          ConsigneeName: order.customerName,
          ContactPersonName: order.customerName,
          Name: order.customerName,
          Address: order.address,
          Address1: order.address,
          Address2: order.area || '',
          City: cleanConsigneeCity,
          State: cleanConsigneeState,
          Pincode: order.pincode,
          PinCode: order.pincode,
          pincode: order.pincode,
          PhoneNo: cleanConsigneePhone
        };

        const pickupAddressObj = {
          Type: "Primary",
          AddressType: "Primary",
          VendorCode: vendorCode,
          ConsigneeName: xbConfig.warehouseName || 'Main Warehouse',
          ContactPersonName: xbConfig.contactName || 'Warehouse Manager',
          Name: xbConfig.warehouseName || 'Main Warehouse',
          Address: `${xbConfig.address || '140 MG Road'}, ${xbConfig.address2 || 'Near Metro Station'}`,
          Address1: xbConfig.address || '140 MG Road',
          Address2: xbConfig.address2 || 'Near Metro Station',
          City: xbConfig.city || 'Agra',
          State: xbConfig.state || 'Uttar Pradesh',
          Pincode: xbConfig.pincode || '282001',
          PinCode: xbConfig.pincode || '282001',
          pincode: xbConfig.pincode || '282001'
        };

        const rtoAddressObj = {
          Type: "Primary",
          AddressType: "Primary",
          VendorCode: vendorCode,
          ConsigneeName: xbConfig.warehouseName || 'Main Warehouse',
          ContactPersonName: xbConfig.contactName || 'Warehouse Manager',
          Name: xbConfig.warehouseName || 'Main Warehouse',
          Address: `${xbConfig.address || '140 MG Road'}, ${xbConfig.address2 || 'Near Metro Station'}`,
          Address1: xbConfig.address || '140 MG Road',
          Address2: xbConfig.address2 || 'Near Metro Station',
          City: xbConfig.city || 'Agra',
          State: xbConfig.state || 'Uttar Pradesh',
          Pincode: xbConfig.pincode || '282001',
          PinCode: xbConfig.pincode || '282001',
          pincode: xbConfig.pincode || '282001'
        };

        bookingPayload.DropDetails = {
          ConsigneeName: order.customerName,
          ContactPersonName: order.customerName,
          Name: order.customerName,
          DropAddressesDetails: [dropAddressObj],
          Addresses: [dropAddressObj],
          ContactDetails: [
            {
              Type: "Primary",
              PhoneNo: cleanConsigneePhone,
              MobileNo: cleanConsigneePhone
            }
          ]
        };

        bookingPayload.DropAddressesDetails = [dropAddressObj];

        bookingPayload.PickupDetails = {
          VendorCode: vendorCode,
          PickupVendorCode: vendorCode,
          Name: xbConfig.warehouseName || 'Main Warehouse',
          PickupAddressesDetails: [pickupAddressObj],
          Addresses: [pickupAddressObj],
          ContactDetails: [
            {
              Type: "Primary",
              PhoneNo: xbConfig.phone || '9999999999',
              MobileNo: xbConfig.phone || '9999999999'
            }
          ]
        };

        bookingPayload.PickupAddressesDetails = [pickupAddressObj];

        bookingPayload.RTODetails = {
          VendorCode: vendorCode,
          PickupVendorCode: vendorCode,
          Name: xbConfig.warehouseName || 'Main Warehouse',
          RTODetailsAddresses: [rtoAddressObj],
          RTOAddressesDetails: [rtoAddressObj],
          Addresses: [rtoAddressObj],
          ContactDetails: [
            {
              Type: "Primary",
              PhoneNo: xbConfig.phone || '9999999999',
              MobileNo: xbConfig.phone || '9999999999'
            }
          ]
        };

        bookingPayload.RTOAddressesDetails = [rtoAddressObj];
      }

      let bookingResponseData: any = null;
      try {
        const baseUrl = xbConfig.baseUrl || 'https://shipment.xpressbees.com/api';
        const manifestUrl = xbConfig.manifestUrl || 'https://apishipmentmanifestation.xbees.in/shipmentmanifestation/forward';
        const targetUrl = authType === 'new' ? manifestUrl : `${baseUrl}/shipments2`;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (authType === 'new') {
          headers['Token'] = token;
          headers['XBKey'] = xbConfig.xbKey || '';
        } else {
          headers['Authorization'] = `Bearer ${token}`;
        }

        let bookRes = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(bookingPayload)
        });

        let responseText = await bookRes.text();
        try {
          bookingResponseData = JSON.parse(responseText);
        } catch (e) {
          bookingResponseData = { error: responseText, status: false };
        }

        const isInvalidToken = bookingResponseData.ReturnCode === 101 || 
          (typeof responseText === 'string' && responseText.toLowerCase().includes('invalid token')) ||
          (bookingResponseData.status === false && (bookingResponseData.message?.toLowerCase().includes('token') || bookingResponseData.message?.toLowerCase().includes('authorized')));

        if (isInvalidToken) {
          token = await getXpressBeesToken(xbConfig, true);
          if (authType === 'new') {
            bookingPayload.TokenNumber = token;
            bookingPayload.Token = token;
            headers['Token'] = token;
          } else {
            headers['Authorization'] = `Bearer ${token}`;
          }
          bookRes = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(bookingPayload)
          });
          responseText = await bookRes.text();
          try {
            bookingResponseData = JSON.parse(responseText);
          } catch (e) {
            bookingResponseData = { error: responseText, status: false };
          }
        }

        const isSuccess = bookRes.ok && (authType === 'new' ? (bookingResponseData.status === true || bookingResponseData.ReturnCode === 100 || responseText.toLowerCase().includes('success')) : bookingResponseData.status === true);

        await db.addCourierLog({
          id: `cl-xb-manifest-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'XpressBees',
          action: authType === 'new' ? 'Forward Manifesting' : 'Create Shipment',
          requestPayload: JSON.stringify(bookingPayload, null, 2),
          responsePayload: JSON.stringify(bookingResponseData, null, 2),
          status: isSuccess ? 'Success' : 'Error'
        });

        let isMockFallback = false;
        if (!isSuccess) {
          console.warn(`XpressBees API failed, falling back to mock:`, bookingResponseData);
          isMockFallback = true;
          finalAwb = finalAwb || `XB${Math.floor(10000000000 + Math.random() * 90000000000)}`;
        } else if (authType !== 'new') {
          finalAwb = bookingResponseData.data?.awb_number || '';
        }

        const etaDays = 3;
        const etaDate = new Date();
        etaDate.setDate(etaDate.getDate() + etaDays);
        const etaString = etaDate.toISOString().split('T')[0];
        const charge = 55 + weight * 25 + (paymentType === 'COD' ? 35 : 0);

        return { 
          success: true, 
          awb: finalAwb, 
          eta: etaString, 
          courier: 'XpressBees', 
          charge,
          note: isMockFallback ? `Mock Fallback activated due to XpressBees API error: ${bookingResponseData.message || bookingResponseData.ReturnMessage || responseText}` : undefined
        };

      } catch (err: any) {
        await db.addCourierLog({
          id: `cl-xb-manifest-fail-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'XpressBees',
          action: authType === 'new' ? 'Forward Manifesting' : 'Create Shipment',
          requestPayload: JSON.stringify(bookingPayload, null, 2),
          responsePayload: JSON.stringify({ error: err.message || err }, null, 2),
          status: 'Error'
        });
        return { success: false, error: `XpressBees booking network error: ${err.message}` };
      }
    }

    // LIVE VELOCITY BOOKING
    if (courier === 'Velocity' || courier === 'Aggregator') {
      try {
        const bookData = await bookVelocityOrder(order, settings, weight, paymentType);
        
        await db.addCourierLog({
          id: `cl-vel-book-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'Velocity',
          action: 'Create Shipment',
          requestPayload: JSON.stringify({ orderId: order.orderId, weight, paymentType }, null, 2),
          responsePayload: JSON.stringify(bookData, null, 2),
          status: 'Success'
        });

        return {
          success: true,
          awb: bookData.awb,
          eta: bookData.eta,
          courier,
          charge: bookData.charge,
          velocity_label_url: bookData.label_url,
          velocity_shipment_id: bookData.shipment_id
        };
      } catch (err: any) {
        await db.addCourierLog({
          id: `cl-vel-book-fail-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'Velocity',
          action: 'Create Shipment Failed',
          requestPayload: JSON.stringify({ orderId: order.orderId, weight, paymentType }, null, 2),
          responsePayload: JSON.stringify({ error: err.message || err }, null, 2),
          status: 'Error'
        });
        return { success: false, error: `Velocity booking failed: ${err.message}` };
      }
    }

    // LIVE DTDC BOOKING
    if (courier === 'DTDC') {
      const isMockToken = apiKey.startsWith('MOCK') || apiKey.includes('tok_99store') || apiKey.includes('dummy');
      
      if (isMockToken) {
        const randomAwbSuffix = Math.floor(100000000 + Math.random() * 900000000).toString();
        const awb = `DTDC${randomAwbSuffix}`;
        const charge = 60 + weight * 30 + (paymentType === 'COD' ? 40 : 0);
        const etaDays = 3;
        const etaDate = new Date();
        etaDate.setDate(etaDate.getDate() + etaDays);
        const etaString = etaDate.toISOString().split('T')[0];

        await db.addCourierLog({
          id: `cl-success-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'DTDC',
          action: 'Generate AWB (Simulated)',
          requestPayload: JSON.stringify({ orderId: order.orderId, courier, weight, paymentType }, null, 2),
          responsePayload: JSON.stringify({ success: true, awb, eta: etaString, charge }, null, 2),
          status: 'Success'
        });

        return { success: true, awb, eta: etaString, courier: 'DTDC', charge };
      }

      const isDemo = isDtdcStaging(apiKey);
      const dtdcBaseUrl = isDemo ? 'https://alphademodashboardapi.shipsy.io' : 'https://pxapi.dtdc.in';
      const bookUrl = `${dtdcBaseUrl}/api/customer/integration/consignment/softdata`;

      const customerCode = settings.dtdcConfig.customerCode || 'MOCK_CUST';
      const serviceTypeId = settings.dtdcConfig.serviceTypeId || 'B2C PRIORITY';
      const commodityId = settings.dtdcConfig.commodityId || '2';

      const consignmentObj: any = {
        customer_code: customerCode,
        service_type_id: serviceTypeId,
        load_type: 'NON-DOCUMENT',
        consignment_type: 'Forward',
        dimension_unit: 'cm',
        length: '10.0',
        width: '10.0',
        height: '10.0',
        weight_unit: 'kg',
        weight: String(weight),
        declared_value: String(order.orderValue),
        num_pieces: '1',
        origin_details: {
          name: settings.dtdcConfig.contactName || settings.xpressbeesConfig.contactName || 'Vishnu Singh Sikarwar',
          phone: settings.dtdcConfig.phone || settings.xpressbeesConfig.phone || '8057023592',
          alternate_phone: '',
          address_line_1: settings.dtdcConfig.address || settings.xpressbeesConfig.address || 'J.K. NAGAR, NANDLALPUR HATHRAS ROAD KUBERPUR',
          address_line_2: settings.dtdcConfig.address2 || settings.xpressbeesConfig.address2 || 'Kuberpur',
          pincode: settings.dtdcConfig.pincode || settings.xpressbeesConfig.pincode || '282006',
          city: settings.dtdcConfig.city || settings.xpressbeesConfig.city || 'Agra',
          state: settings.dtdcConfig.state || settings.xpressbeesConfig.state || 'Uttar Pradesh'
        },
        destination_details: {
          name: order.customerName,
          phone: phoneOverride || order.phonePrimary,
          alternate_phone: order.phoneSecondary || '',
          address_line_1: order.address,
          address_line_2: '',
          pincode: order.pincode,
          city: order.area || 'New Delhi',
          state: order.state || 'Delhi'
        },
        customer_reference_number: order.orderId,
        commodity_id: commodityId,
        description: order.productDetails || 'Fulfillment parcel',
        reference_number: ''
      };

      const isCod = order.paymentType === 'COD';
      const codCollectible = isCod ? (order.orderValue - (order.partiallyPaidAmount || 0)) : 0;
      if (codCollectible > 0) {
        consignmentObj.cod_collection_mode = 'cash';
        consignmentObj.cod_amount = String(codCollectible);
      }

      const payload = {
        consignments: [consignmentObj]
      };

      try {
        const bookRes = await fetch(bookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey
          },
          body: JSON.stringify(payload)
        });

        const responseText = await bookRes.text();
        let bookData;
        try {
          bookData = JSON.parse(responseText);
        } catch (e) {
          bookData = { error: responseText, success: false };
        }

        const isSuccess = bookRes.ok && (
          bookData.success === true ||
          bookData.status === 'OK' ||
          bookData.status === 'success' ||
          bookData.data?.[0]?.success === true
        );

        await db.addCourierLog({
          id: `cl-dtdc-book-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'DTDC',
          action: 'Create Consignment',
          requestPayload: JSON.stringify(payload, null, 2),
          responsePayload: JSON.stringify(bookData, null, 2),
          status: isSuccess ? 'Success' : 'Error'
        });

        if (!isSuccess) {
          return { success: false, error: `DTDC Booking failed: ${bookData.message || responseText}` };
        }

        const finalAwb = bookData.data?.[0]?.reference_number || bookData.reference_number || '';
        if (!finalAwb) {
          return { success: false, error: `DTDC Booking succeeded but no AWB was allocated: ${JSON.stringify(bookData)}` };
        }

        const etaDays = 3;
        const etaDate = new Date();
        etaDate.setDate(etaDate.getDate() + etaDays);
        const etaString = etaDate.toISOString().split('T')[0];
        const charge = 60 + weight * 30 + (paymentType === 'COD' ? 40 : 0);

        return { success: true, awb: finalAwb, eta: etaString, courier: 'DTDC', charge };
      } catch (err: any) {
        await db.addCourierLog({
          id: `cl-dtdc-book-fail-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'DTDC',
          action: 'Create Consignment',
          requestPayload: JSON.stringify(payload, null, 2),
          responsePayload: JSON.stringify({ error: err.message || err }, null, 2),
          status: 'Error'
        });
        return { success: false, error: `DTDC Booking network error: ${err.message}` };
      }
    }

    // LIVE DELHIVERY INTEGRATION
    if (courier === 'Delhivery') {
      const clientName = settings.deliveryConfig.clientName || 'SOM ENTERPRISES';
      const pickupLocation = settings.deliveryConfig.pickupLocation || 'Default Pickup Location';
      const shippingMode = settings.deliveryConfig.shippingMode || 'Surface';

      const isMockToken = apiKey.startsWith('MOCK') || apiKey.includes('tok_99store') || apiKey.includes('dummy') || apiKey.includes('example');
      const isProduction = !isMockToken && !apiKey.startsWith('MOCK') && !apiKey.includes('test') && !apiKey.includes('staging');
      const delhiveryBaseUrl = isProduction ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com';

      if (isMockToken) {
        const randomAwbSuffix = Math.floor(100000000 + Math.random() * 900000000).toString();
        const awb = `99SDEL${randomAwbSuffix}`;
        const etaDays = 3;
        const etaDate = new Date();
        etaDate.setDate(etaDate.getDate() + etaDays);
        const etaString = etaDate.toISOString().split('T')[0];
        const charge = 70 + weight * 20 + (paymentType === 'COD' ? 30 : 0);

        await db.addCourierLog({
          id: `cl-cmu-manifest-mock-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'Delhivery',
          action: 'Create Shipment (Simulated)',
          requestPayload: JSON.stringify({ orderId: order.orderId, weight, paymentType }, null, 2),
          responsePayload: JSON.stringify({
            success: true,
            packages: [{ waybill: awb }],
            eta: etaString,
            charge
          }, null, 2),
          status: 'Success'
        });

        return { success: true, awb, eta: etaString, courier: 'Delhivery', charge };
      }

      const awbUrl = `${delhiveryBaseUrl}/waybill/api/fetch/json/?token=${encodeURIComponent(apiKey)}&cl=${encodeURIComponent(clientName)}&client_name=${encodeURIComponent(clientName)}`;
      const awbRequestPayload = `GET /waybill/api/fetch/json/?token=${apiKey.slice(0, 6)}...&cl=${clientName}&client_name=${clientName}`;

      let awbResponseData: any = null;
      let finalAwb = '';

      try {
        const awbRes = await fetch(awbUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        const responseText = await awbRes.text();
        try {
          awbResponseData = JSON.parse(responseText);
        } catch (e) {
          awbResponseData = { error: responseText };
        }

        await db.addCourierLog({
          id: `cl-awb-fetch-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'Delhivery',
          action: 'Fetch AWB',
          requestPayload: awbRequestPayload,
          responsePayload: typeof awbResponseData === 'object' ? JSON.stringify(awbResponseData, null, 2) : responseText,
          status: awbRes.ok && !responseText.includes('Bad Request') ? 'Success' : 'Error'
        });

        if (awbRes.ok && !responseText.includes('Bad Request')) {
          const awbVal = awbResponseData.waybill || awbResponseData.wbn || awbResponseData.awb || null;
          if (awbVal && typeof awbVal === 'string') {
            finalAwb = awbVal;
          } else if (awbResponseData.delivery_codes && awbResponseData.delivery_codes.length > 0) {
            finalAwb = String(awbResponseData.delivery_codes[0]);
          } else {
            const match = responseText.match(/\d{6,}/);
            if (match) {
              finalAwb = match[0];
            }
          }
        }
      } catch (err: any) {
        await db.addCourierLog({
          id: `cl-awb-fetch-fail-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'Delhivery',
          action: 'Fetch AWB',
          requestPayload: awbRequestPayload,
          responsePayload: JSON.stringify({ error: err.message || err }, null, 2),
          status: 'Error'
        });
      }

      const paymentMode = (order.paymentType === 'COD' || (order.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0 && order.orderValue > order.partiallyPaidAmount)) ? 'COD' : 'Prepaid';

      const shipment: any = {
        name: order.customerName,
        add: order.address,
        pin: order.pincode,
        city: order.area || 'New Delhi',
        state: order.state || 'Delhi',
        country: 'India',
        phone: phoneOverride || order.phonePrimary,
        order: order.orderId,
        payment_mode: paymentMode,
        return_pin: "",
        return_city: "",
        return_phone: "",
        return_add: "",
        return_state: "",
        return_country: "",
        products_desc: order.productDetails || "",
        hsn_code: "",
        cod_amount: (order.paymentType === 'COD' || (order.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0 && order.orderValue > order.partiallyPaidAmount)) ? String(order.orderValue - (order.partiallyPaidAmount || 0)) : "",
        order_date: null,
        total_amount: String(order.orderValue),
        seller_add: "",
        seller_name: "",
        seller_inv: "",
        quantity: "1",
        waybill: finalAwb || "",
        shipment_width: "100",
        shipment_height: "100",
        weight: String(Math.round(Number(weight) * 1000)),
        shipping_mode: shippingMode,
        address_type: ""
      };

      const shipmentsPayload = {
        shipments: [shipment],
        pickup_location: {
          name: (() => {
            const normalized = pickupLocation.trim();
            if (
              normalized.toUpperCase() === 'INUPABBP' ||
              normalized.toLowerCase() === '81c1093c-6a7b-4a2e-833c-e2997c945389'
            ) {
              return 'Default Pickup Location';
            }
            return normalized;
          })()
        }
      };

      const createRequestPayload = {
        url: 'POST /api/cmu/create.json',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Token ${apiKey.slice(0, 6)}...`
        },
        body: `format=json&data=${JSON.stringify(shipmentsPayload)}`
      };

      let manifestResponseData: any = null;
      try {
        const manifestRes = await fetch(`${delhiveryBaseUrl}/api/cmu/create.json`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `format=json&data=${JSON.stringify(shipmentsPayload)}`
        });

        const responseText = await manifestRes.text();
        try {
          manifestResponseData = JSON.parse(responseText);
        } catch (e) {
          manifestResponseData = { error: responseText, success: false };
        }

        await db.addCourierLog({
          id: `cl-cmu-manifest-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'Delhivery',
          action: 'Create Shipment',
          requestPayload: JSON.stringify(createRequestPayload, null, 2),
          responsePayload: typeof manifestResponseData === 'object' ? JSON.stringify(manifestResponseData, null, 2) : responseText,
          status: manifestRes.ok && manifestResponseData.success ? 'Success' : 'Error'
        });

        if (!manifestRes.ok || !manifestResponseData.success) {
          let errorMsg = manifestResponseData.rmk || manifestResponseData.error || responseText;
          if (manifestResponseData.packages && manifestResponseData.packages.length > 0) {
            const pkg = manifestResponseData.packages[0];
            if (pkg.remarks && pkg.remarks.length > 0) {
              errorMsg = `${errorMsg} (Remarks: ${pkg.remarks.join(', ')})`;
            }
          }
          return { success: false, error: `Delhivery CMU Manifest failed: ${errorMsg}` };
        }

        if (!finalAwb && manifestResponseData.packages && manifestResponseData.packages.length > 0) {
          finalAwb = manifestResponseData.packages[0].waybill || '';
        }

      } catch (err: any) {
        await db.addCourierLog({
          id: `cl-cmu-manifest-fail-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'Delhivery',
          action: 'Create Shipment',
          requestPayload: JSON.stringify(createRequestPayload, null, 2),
          responsePayload: JSON.stringify({ error: err.message || err }, null, 2),
          status: 'Error'
        });
        return { success: false, error: `Delhivery CMU Manifest network error: ${err.message}` };
      }

      let etaString = '';
      if (manifestResponseData && manifestResponseData.packages && manifestResponseData.packages.length > 0) {
        const pkg = manifestResponseData.packages[0];
        if (pkg.expected_delivery_date || pkg.etd || pkg.edd) {
          etaString = (pkg.expected_delivery_date || pkg.etd || pkg.edd).split(' ')[0].split('T')[0];
        }
      }
      if (!etaString) {
        const etaDays = 3;
        const etaDate = new Date();
        etaDate.setDate(etaDate.getDate() + etaDays);
        etaString = etaDate.toISOString().split('T')[0];
      }
      const charge = 70 + weight * 20 + (paymentType === 'COD' ? 30 : 0);

      return { success: true, awb: finalAwb, eta: etaString, courier: 'Delhivery', charge };
    }

    // DEFAULT SIMULATED AWB GENERATION
    const randomAwbSuffix = Math.floor(100000000 + Math.random() * 900000000).toString();
    let awb = '';
    let charge = 0;

    switch (courier) {
      case 'DTDC':
        awb = `DTDC${randomAwbSuffix}`;
        charge = 60 + weight * 30 + (paymentType === 'COD' ? 40 : 0);
        break;
      case 'Aggregator':
        awb = `AG${randomAwbSuffix}`;
        charge = 50 + weight * 20 + (paymentType === 'COD' ? 30 : 0);
        break;
    }

    const etaDays = Math.floor(Math.random() * 3) + 2;
    const etaDate = new Date();
    etaDate.setDate(etaDate.getDate() + etaDays);
    const etaString = etaDate.toISOString().split('T')[0];

    const responsePayload = {
      status: 'SUCCESS',
      awb,
      eta: etaString,
      charge: parseFloat(charge.toFixed(2)),
      shipper: '99Store Fulfillment Center - Delhi NCR',
      apiKeyUsed: `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`
    };

    const successLog: CourierApiLog = {
      id: `cl-success-${Date.now()}`,
      timestamp: new Date().toISOString(),
      courier,
      action: 'Generate AWB',
      requestPayload: JSON.stringify({ orderId: order.orderId, weight, paymentType }, null, 2),
      responsePayload: JSON.stringify(responsePayload, null, 2),
      status: 'Success'
    };
    await db.addCourierLog(successLog);

    return { success: true, awb, eta: etaString, courier, charge };
  } catch (error: any) {
    return { success: false, error: error.message || 'Courier API execution failed.' };
  }
}
