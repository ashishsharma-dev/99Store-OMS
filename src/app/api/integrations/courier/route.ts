import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CourierApiLog, SystemSettings } from '@/lib/types';
import { getXpressBeesToken, resolveXpressBeesConfig } from '@/lib/xpressbees';
import { syncOrderStatus } from '@/lib/courierSync';
import { bookVelocityOrder, trackVelocityShipment, cancelVelocityShipment } from '@/lib/velocity';

function isDtdcStaging(apiKey?: string, username?: string): boolean {
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

function cleanCityName(area: string, state: string, pincode: string): string {
  let clean = (area || '').trim();
  
  // If it has a comma, take the last part (e.g. "Bandra West, Mumbai" -> "Mumbai")
  if (clean.includes(',')) {
    clean = clean.split(',').pop()!.trim();
  }
  
  // Remove trailing details, parentheses, etc.
  clean = clean.replace(/\(.*\)/g, '').trim();

  // If it is a zone fallback or doesn't look like a real city name, map based on state/pincode prefix
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
    return 'Mumbai'; // Default fallback
  }
  
  return clean;
}

function cleanStateName(state: string, pincode: string): string {
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

async function replenishAwbPool(settings: SystemSettings, token: string) {
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const waybill = searchParams.get('waybill');
    const queryCourier = searchParams.get('courier');

    if (!action || !waybill) {
      return NextResponse.json({ error: 'Missing action or waybill parameter.' }, { status: 400 });
    }

    const settings = await db.getSettings();

    const isVelocity = queryCourier === 'Velocity' || queryCourier === 'Aggregator' || waybill.startsWith('VEL') || (await db.getOrders()).some(o => o.awb === waybill && (o.courier === 'Velocity' || o.courier === 'Aggregator'));
    const isXpressBees = queryCourier === 'XpressBees' || waybill.startsWith('XB') || waybill.startsWith('5963');
    const isDtdc = queryCourier === 'DTDC' || waybill.startsWith('DTDC');

    if (isVelocity) {
      if (!settings.velocityActive && !settings.aggregatorActive) {
        return NextResponse.json({ error: 'Velocity integration is disabled in settings.' }, { status: 400 });
      }

      if (action === 'track') {
        try {
          const unifiedData = await trackVelocityShipment(waybill, settings);
          await db.addCourierLog({
            id: `cl-vel-track-${Date.now()}`,
            timestamp: new Date().toISOString(),
            courier: 'Velocity',
            action: 'Track Shipment',
            requestPayload: `POST /custom/api/v1/order-tracking awbs: [${waybill}]`,
            responsePayload: JSON.stringify(unifiedData, null, 2),
            status: 'Success'
          });

          const courierStatus = unifiedData?.ShipmentData?.[0]?.Shipment?.Status?.Status;
          const scanLocation = unifiedData?.ShipmentData?.[0]?.Shipment?.Status?.StatusLocation;
          const latestScan = unifiedData?.ShipmentData?.[0]?.Shipment?.Scans?.[0]?.ScanDetail;
          const customRemarks = latestScan ? `${latestScan.Scan}. Remarks: ${latestScan.Instructions}` : undefined;
          if (courierStatus) {
            await syncOrderStatus(waybill, courierStatus, scanLocation, customRemarks);
          }
          return NextResponse.json(unifiedData);
        } catch (err: any) {
          return NextResponse.json({ error: `Velocity tracking failed: ${err.message}` }, { status: 500 });
        }
      }

      if (action === 'label') {
        const order = (await db.getOrders()).find(o => o.awb === waybill);
        if (!order || !order.velocity_label_url) {
          return NextResponse.json({ error: 'Velocity label URL not found for order.' }, { status: 404 });
        }

        try {
          const labelRes = await fetch(order.velocity_label_url);
          if (!labelRes.ok) {
            return NextResponse.json({ error: `Failed to fetch Velocity label PDF: HTTP ${labelRes.status}` }, { status: 400 });
          }

          const blob = await labelRes.blob();
          order.label_generated = true;
          await db.saveOrder(order);

          return new Response(blob, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="label-${waybill}.pdf"`
            }
          });
        } catch (err: any) {
          return NextResponse.json({ error: `Failed to proxy Velocity label: ${err.message}` }, { status: 500 });
        }
      }
    }

    if (isXpressBees) {
      if (!settings.xpressbeesActive) {
        return NextResponse.json({ error: 'XpressBees integration is disabled in settings.' }, { status: 400 });
      }

      if (action === 'track') {
        const xbConfig = resolveXpressBeesConfig(settings.xpressbeesConfig);
        const token = await getXpressBeesToken(xbConfig);
        const isMockToken = token === 'MOCK_TOKEN_12345';
        const baseUrl = xbConfig.baseUrl || 'https://shipment.xpressbees.com/api';

        if (isMockToken) {
          // Simulated tracking response matching unified Delhivery/XpressBees format
          const simulatedTracking = {
            ShipmentData: [
              {
                Shipment: {
                  AWB: waybill,
                  Consignee: { Name: "Simulated XpressBees Recipient" },
                  Status: {
                    Status: "Out for Delivery",
                    StatusLocation: "Agra Hub",
                    StatusDateTime: new Date().toISOString()
                  },
                  Scans: [
                    {
                      ScanDetail: {
                        Scan: "Out for Delivery",
                        ScanDateTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                        ScannedLocation: "Agra Delivery Hub",
                        Instructions: "Delivery associate Vikram (9876543211) dispatched with package."
                      }
                    },
                    {
                      ScanDetail: {
                        Scan: "In Transit",
                        ScanDateTime: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
                        ScannedLocation: "Delhi Hub",
                        Instructions: "Departed from warehouse hub."
                      }
                    },
                    {
                      ScanDetail: {
                        Scan: "Manifest Uploaded",
                        ScanDateTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                        ScannedLocation: "Main Warehouse",
                        Instructions: "Order Booked & AWB assigned via XpressBees."
                      }
                    }
                  ]
                }
              }
            ]
          };

          await db.addCourierLog({
            id: `cl-xb-track-${Date.now()}`,
            timestamp: new Date().toISOString(),
            courier: 'XpressBees',
            action: 'Track Shipment (Simulated)',
            requestPayload: `GET /shipments2/track/${waybill}`,
            responsePayload: JSON.stringify(simulatedTracking, null, 2),
            status: 'Success'
          });

          // Auto-sync status to database
          const courierStatus = simulatedTracking.ShipmentData[0].Shipment.Status.Status;
          const scanLocation = simulatedTracking.ShipmentData[0].Shipment.Status.StatusLocation;
          const latestScan = simulatedTracking.ShipmentData[0].Shipment.Scans?.[0]?.ScanDetail;
          const customRemarks = latestScan ? `${latestScan.Scan}. Remarks: ${latestScan.Instructions}` : undefined;
          await syncOrderStatus(waybill, courierStatus, scanLocation, customRemarks);

          return NextResponse.json(simulatedTracking);
        }

        // Live API call
        const authType = xbConfig.authType || 'new';
        let res;
        let data;
        let reqPayloadStr = '';

        if (authType === 'new') {
          const trackUrl = xbConfig.trackBulkUrl || 'https://apishipmenttracking.xbees.in/GetCurrentShipmentStatus';
          reqPayloadStr = `POST ${trackUrl} body: { awb: ${waybill} }`;
          res = await fetch(trackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Token': token,
              'token': token,
              'TokenNumber': token,
              'XBKey': xbConfig.xbKey || '',
              'xb-key': xbConfig.xbKey || '',
              'versionnumber': 'v1'
            },
            body: JSON.stringify({
              awb: waybill,
              awbs: [waybill],
              TokenNumber: token,
              Token: token
            })
          });
          data = await res.json();
        } else {
          reqPayloadStr = `GET ${baseUrl}/shipments2/track/${waybill}`;
          res = await fetch(`${baseUrl}/shipments2/track/${encodeURIComponent(waybill)}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          data = await res.json();
        }

        // Map XpressBees to Delhivery format if needed for rendering uniformity
        let unifiedData = data;
        if (data && !data.ShipmentData) {
          const rawScans = Array.isArray(data.scans) 
            ? data.scans 
            : Array.isArray(data.data) 
              ? data.data 
              : Array.isArray(data) 
                ? data 
                : (data.history || []);
          const statusVal = (typeof data.status === 'string' ? data.status : null) || 
                            (typeof data.current_status === 'string' ? data.current_status : null) || 
                            (data.data && typeof data.data.status === 'string' ? data.data.status : null) || 
                            'In Transit';
          const locationVal = (typeof data.location === 'string' ? data.location : null) || 
                              (data.data && typeof data.data.location === 'string' ? data.data.location : null) || 
                              'Origin Hub';

          unifiedData = {
            ShipmentData: [
              {
                Shipment: {
                  AWB: waybill,
                  Status: {
                    Status: statusVal,
                    StatusLocation: locationVal
                  },
                  Scans: rawScans.map((s: any) => ({
                    ScanDetail: {
                      ScannedLocation: s.location || s.activity_office || s.scannedLocation || 'Hub',
                      ScanDateTime: s.date || s.time || s.activity_date || s.scanDateTime || new Date().toISOString(),
                      Scan: s.status || s.activity || s.scan || 'Scan Recorded',
                      Instructions: s.remarks || s.status_description || s.instructions || ''
                    }
                  }))
                }
              }
            ]
          };
        }

        await db.addCourierLog({
          id: `cl-xb-track-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'XpressBees',
          action: 'Track Shipment',
          requestPayload: reqPayloadStr,
          responsePayload: JSON.stringify(data, null, 2),
          status: res.ok ? 'Success' : 'Error'
        });

        // Auto-sync status to database
        const courierStatus = unifiedData?.ShipmentData?.[0]?.Shipment?.Status?.Status;
        const scanLocation = unifiedData?.ShipmentData?.[0]?.Shipment?.Status?.StatusLocation;
        const liveEta = data?.expected_delivery_date || data?.data?.expected_delivery_date || data?.ExpectedDeliveryDate || data?.edd || null;
        const latestScan = unifiedData?.ShipmentData?.[0]?.Shipment?.Scans?.[0]?.ScanDetail;
        const customRemarks = latestScan ? `${latestScan.Scan}. Remarks: ${latestScan.Instructions}` : undefined;
        if (courierStatus) {
          await syncOrderStatus(waybill, courierStatus, scanLocation, customRemarks, liveEta);
        }

        return NextResponse.json(unifiedData);
      }

      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    if (isDtdc) {
      if (!settings.dtdcActive) {
        return NextResponse.json({ error: 'DTDC integration is disabled in settings.' }, { status: 400 });
      }

      const apiKey = settings.dtdcConfig.apiKey;
      const isMockToken = apiKey.startsWith('MOCK') || apiKey.includes('tok_99store') || apiKey.includes('dummy');

      if (action === 'track') {
        if (isMockToken) {
          const simulatedTracking = {
            ShipmentData: [
              {
                Shipment: {
                  AWB: waybill,
                  Consignee: { Name: "Simulated DTDC Recipient" },
                  Status: {
                    Status: "Out for Delivery",
                    StatusLocation: "Delhi Hub",
                    StatusDateTime: new Date().toISOString()
                  },
                  Scans: [
                    {
                      ScanDetail: {
                        Scan: "Out for Delivery",
                        ScanDateTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
                        ScannedLocation: "Delhi Delivery Hub",
                        Instructions: "Delivery associate out with parcel."
                      }
                    },
                    {
                      ScanDetail: {
                        Scan: "In Transit",
                        ScanDateTime: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
                        ScannedLocation: "Agra Hub",
                        Instructions: "Departed from facility."
                      }
                    },
                    {
                      ScanDetail: {
                        Scan: "Manifest Uploaded",
                        ScanDateTime: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
                        ScannedLocation: "Warehouse",
                        Instructions: "Soft booking generated via DTDC."
                      }
                    }
                  ]
                }
              }
            ]
          };

          await db.addCourierLog({
            id: `cl-dtdc-track-${Date.now()}`,
            timestamp: new Date().toISOString(),
            courier: 'DTDC',
            action: 'Track Shipment (Simulated)',
            requestPayload: `GET /dtdc-tracking-api/rest/JSONCnTrk/getTrackDetails AWB: ${waybill}`,
            responsePayload: JSON.stringify(simulatedTracking, null, 2),
            status: 'Success'
          });

          const latestScan = simulatedTracking.ShipmentData[0].Shipment.Scans?.[0]?.ScanDetail;
          const customRemarks = latestScan ? `${latestScan.Scan}. Remarks: ${latestScan.Instructions}` : undefined;
          await syncOrderStatus(waybill, 'Out for Delivery', 'Delhi Hub', customRemarks);
          return NextResponse.json(simulatedTracking);
        }

        // Live DTDC Tracking
        const username = settings.dtdcConfig.username || 'username';
        const password = settings.dtdcConfig.password || 'password';
        const isStaging = isDtdcStaging(apiKey, username);

        const trackAuthUrl = isStaging 
          ? 'https://dtdcstagingapi.dtdc.com/dtdc-api/api/dtdc/authenticate' 
          : 'https://blktracksvc.dtdc.com/dtdc-api/api/dtdc/authenticate';
          
        const trackDetailsUrl = isStaging
          ? 'https://dtdcstagingapi.dtdc.com/dtdc-tracking-api/dtdc-api/rest/JSONCnTrk/getTrackDetails'
          : 'https://blktracksvc.dtdc.com/dtdc-api/rest/JSONCnTrk/getTrackDetails';

        let accessToken = settings.dtdcConfig.accessToken || '';
        if (!accessToken) {
          let authResponseText = '';
          try {
            const authRes = await fetch(`${trackAuthUrl}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
              method: 'GET'
            });
            authResponseText = await authRes.text();
            accessToken = authRes.headers.get('X-Access-Token') || authRes.headers.get('x-access-token') || authResponseText.trim();
            try {
              const authJson = JSON.parse(authResponseText);
              accessToken = authJson.token || authJson.accessToken || authJson.xAccessToken || accessToken;
            } catch(e) {}
          } catch (authErr: any) {
            return NextResponse.json({ error: `DTDC Tracking Auth failed: ${authErr.message}` }, { status: 500 });
          }
        }

        // Make tracking API request using token
        const trackPayload = {
          trkType: 'cnno',
          strcnno: waybill,
          addtnlDtl: 'Y'
        };

        try {
          const trackRes = await fetch(trackDetailsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-access-token': accessToken,
              'X-Access-Token': accessToken
            },
            body: JSON.stringify(trackPayload)
          });

          const trackResText = await trackRes.text();
          let trackData;
          try {
            trackData = JSON.parse(trackResText);
          } catch (e) {
            trackData = { error: trackResText };
          }

          await db.addCourierLog({
            id: `cl-dtdc-track-${Date.now()}`,
            timestamp: new Date().toISOString(),
            courier: 'DTDC',
            action: 'Track Shipment',
            requestPayload: `POST ${trackDetailsUrl}\nPayload: ${JSON.stringify(trackPayload)}`,
            responsePayload: JSON.stringify(trackData, null, 2),
            status: trackRes.ok ? 'Success' : 'Error'
          });

          // Normalize/Map DTDC structure to unified format
          const rawScans = Array.isArray(trackData) 
            ? trackData 
            : Array.isArray(trackData.scans) 
              ? trackData.scans 
              : Array.isArray(trackData.data) 
                ? trackData.data 
                : (trackData.history || []);
                
          // Fetch current status
          const currentStatus = (typeof trackData.status === 'string' ? trackData.status : null) || 
                                (typeof trackData.current_status === 'string' ? trackData.current_status : null) || 
                                (trackData.data && typeof trackData.data.status === 'string' ? trackData.data.status : null) || 
                                'In Transit';
          const currentLocation = (typeof trackData.location === 'string' ? trackData.location : null) || 
                                  (trackData.data && typeof trackData.data.location === 'string' ? trackData.data.location : null) || 
                                  'Origin Hub';

          const unifiedData = {
            ShipmentData: [
              {
                Shipment: {
                  AWB: waybill,
                  Status: {
                    Status: currentStatus,
                    StatusLocation: currentLocation
                  },
                  Scans: rawScans.map((s: any) => ({
                    ScanDetail: {
                      ScannedLocation: s.activityLocation || s.location || 'Hub',
                      ScanDateTime: s.statusDate ? `${s.statusDate}T${s.statusTime || '00:00:00'}` : new Date().toISOString(),
                      Scan: s.activity || s.status || 'Scan Recorded',
                      Instructions: s.remarks || s.instructions || ''
                    }
                  }))
                }
              }
            ]
          };

          // Auto-sync status to database
          const liveEta = trackData?.expected_delivery_date || trackData?.expectedDeliveryDate || trackData?.edd || (trackData?.data && (trackData.data.expected_delivery_date || trackData.data.expectedDeliveryDate)) || null;
          const latestScan = unifiedData?.ShipmentData?.[0]?.Shipment?.Scans?.[0]?.ScanDetail;
          const customRemarks = latestScan ? `${latestScan.Scan}. Remarks: ${latestScan.Instructions}` : undefined;
          if (currentStatus) {
            await syncOrderStatus(waybill, currentStatus, currentLocation, customRemarks, liveEta);
          }

          return NextResponse.json(unifiedData);
        } catch (err: any) {
          return NextResponse.json({ error: `DTDC Tracking Request failed: ${err.message}` }, { status: 500 });
        }
      }

      if (action === 'label') {
        if (isMockToken) {
          return NextResponse.json({
            success: true,
            label_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
          });
        }

        const isDemo = isDtdcStaging(apiKey);
        const dtdcBaseUrl = isDemo ? 'https://alphademodashboardapi.shipsy.io' : 'https://pxapi.dtdc.in';
        const labelUrl = `${dtdcBaseUrl}/api/customer/integration/consignment/shippinglabel/stream?reference_number=${encodeURIComponent(waybill)}&label_code=SHIP_LABEL_4X6&label_format=pdf`;

        try {
          const labelRes = await fetch(labelUrl, {
            method: 'GET',
            headers: {
              'api-key': apiKey
            }
          });

          if (!labelRes.ok) {
            return NextResponse.json({ error: `Failed to fetch DTDC label: HTTP ${labelRes.status}` }, { status: 400 });
          }

          const blob = await labelRes.blob();

          const order = (await db.getOrders()).find(o => o.awb === waybill || o.dtdc_reference_number === waybill);
          if (order) {
            order.label_generated = true;
            await db.saveOrder(order);
          }

          return new Response(blob, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="label-${waybill}.pdf"`
            }
          });
        } catch (err: any) {
          return NextResponse.json({ error: `Failed to proxy DTDC label: ${err.message}` }, { status: 500 });
        }
      }
    }

    // Default Delhivery integration GET logic
    const apiKey = settings.deliveryConfig.apiKey;
    if (!settings.deliveryActive || !apiKey) {
      return NextResponse.json({ error: 'Delhivery integration is disabled or not configured in settings.' }, { status: 400 });
    }

    const isMockToken = apiKey.startsWith('MOCK') || apiKey.includes('tok_99store') || apiKey.includes('dummy') || apiKey.includes('example');
    const isProduction = !isMockToken && !apiKey.startsWith('MOCK') && !apiKey.includes('test') && !apiKey.includes('staging');
    const delhiveryBaseUrl = isProduction ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com';

    if (isMockToken) {
      if (action === 'track') {
        let simulatedTracking;
        let targetStatus = 'Out for Delivery';
        let targetLocation = 'Delhi Hub';
        let targetRemarks = 'Package out for delivery.';

        if (waybill === '1635310036396') {
          targetStatus = 'Maximum attempts reached';
          targetLocation = 'Vrindavan_Jait_D (Uttar Pradesh)';
          targetRemarks = 'customer is not available or denied for the acceptance of the parcel';
          
          simulatedTracking = {
            ShipmentData: [
              {
                Shipment: {
                  AWB: "1635310036396",
                  ReferenceNo: "99S-1059",
                  Status: {
                    Status: targetStatus,
                    StatusLocation: targetLocation,
                    StatusDateTime: new Date().toISOString()
                  },
                  Scans: [
                    {
                      ScanDetail: {
                        Scan: targetStatus,
                        ScanDateTime: new Date().toISOString(),
                        ScannedLocation: targetLocation,
                        Instructions: targetRemarks
                      }
                    },
                    {
                      ScanDetail: {
                        Scan: "Out for Delivery",
                        ScanDateTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                        ScannedLocation: "Vrindavan_Jait_D (Uttar Pradesh)",
                        Instructions: "Package out for delivery."
                      }
                    },
                    {
                      ScanDetail: {
                        Scan: "In Transit",
                        ScanDateTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                        ScannedLocation: "Hub Agra",
                        Instructions: "Departed hub."
                      }
                    }
                  ]
                }
              }
            ]
          };
        } else {
          simulatedTracking = {
            ShipmentData: [
              {
                Shipment: {
                  AWB: waybill,
                  Status: {
                    Status: targetStatus,
                    StatusLocation: targetLocation,
                    StatusDateTime: new Date().toISOString()
                  },
                  Scans: [
                    {
                      ScanDetail: {
                        Scan: "Out for Delivery",
                        ScanDateTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                        ScannedLocation: "Delhi Hub",
                        Instructions: "Package out for delivery."
                      }
                    },
                    {
                      ScanDetail: {
                        Scan: "In Transit",
                        ScanDateTime: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
                        ScannedLocation: "Hub Agra",
                        Instructions: "Departed hub."
                      }
                    }
                  ]
                }
              }
            ]
          };
        }

        await db.addCourierLog({
          id: `cl-track-mock-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'Delhivery',
          action: 'Track Shipment (Simulated)',
          requestPayload: `GET /api/v1/packages/json/?waybill=${waybill}`,
          responsePayload: JSON.stringify(simulatedTracking, null, 2),
          status: 'Success'
        });

        await syncOrderStatus(waybill, targetStatus, targetLocation, targetRemarks);
        return NextResponse.json(simulatedTracking);
      }

      if (action === 'label') {
        const simulatedLabel = {
          success: true,
          label_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        };

        await db.addCourierLog({
          id: `cl-label-mock-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'Delhivery',
          action: 'Packing Slip (Simulated)',
          requestPayload: `GET /api/p/packing_slip?wbns=${waybill}`,
          responsePayload: JSON.stringify(simulatedLabel, null, 2),
          status: 'Success'
        });

        return NextResponse.json(simulatedLabel);
      }
    }

    if (action === 'track') {

      const url = `${delhiveryBaseUrl}/api/v1/packages/json/?token=${encodeURIComponent(apiKey)}&waybill=${encodeURIComponent(waybill)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json();

      await db.addCourierLog({
        id: `cl-track-${Date.now()}`,
        timestamp: new Date().toISOString(),
        courier: 'Delhivery',
        action: 'Track Shipment',
        requestPayload: `GET /api/v1/packages/json/?waybill=${waybill}`,
        responsePayload: JSON.stringify(data, null, 2),
        status: res.ok ? 'Success' : 'Error'
      });

      // Auto-sync status to database
      const courierStatus = data?.ShipmentData?.[0]?.Shipment?.Status?.Status;
      const scanLocation = data?.ShipmentData?.[0]?.Shipment?.Status?.StatusLocation;
      const liveEta = data?.ShipmentData?.[0]?.Shipment?.ExpectedDeliveryDate || data?.ShipmentData?.[0]?.Shipment?.expected_delivery_date || data?.expected_delivery_date || null;
      const latestScan = data?.ShipmentData?.[0]?.Shipment?.Scans?.[0]?.ScanDetail;
      const statusObj = data?.ShipmentData?.[0]?.Shipment?.Status;
      const customRemarks = `Current Status: "${statusObj?.Status}" [Type: ${statusObj?.StatusType || 'UD'}, Instructions: ${statusObj?.Instructions || ''}]. Latest Scan: ${latestScan ? `${latestScan.Scan} (${latestScan.Instructions})` : 'None'}`;
      if (courierStatus) {
        await syncOrderStatus(waybill, courierStatus, scanLocation, customRemarks, liveEta);
      }

      return NextResponse.json(data);
    }

    if (action === 'label') {
      const url = `${delhiveryBaseUrl}/api/p/packing_slip?wbns=${encodeURIComponent(waybill)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Accept': 'application/json'
        }
      });
      const data = await res.json();

      await db.addCourierLog({
        id: `cl-label-${Date.now()}`,
        timestamp: new Date().toISOString(),
        courier: 'Delhivery',
        action: 'Packing Slip',
        requestPayload: `GET /api/p/packing_slip?wbns=${waybill}`,
        responsePayload: JSON.stringify(data, null, 2),
        status: res.ok ? 'Success' : 'Error'
      });

      return NextResponse.json(data);
    }

    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Courier GET request failed.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || 'book'; // 'book' | 'cancel' | 'manifest' | 'reverse'
    const settings = await db.getSettings();

    // 1. CANCEL SHIPMENT
    if (action === 'cancel') {
      const { waybill, courier } = body;
      if (!waybill) {
        return NextResponse.json({ error: 'Missing AWB waybill parameter for cancellation.' }, { status: 400 });
      }

      const isVelocity = courier === 'Velocity' || courier === 'Aggregator' || waybill.startsWith('VEL');
      const isXpressBees = courier === 'XpressBees' || waybill.startsWith('XB');
      const isDtdc = courier === 'DTDC' || waybill.startsWith('DTDC');

      if (isVelocity) {
        try {
          const cancelData = await cancelVelocityShipment(waybill, settings);
          const order = (await db.getOrders()).find(o => o.awb === waybill);
          if (order) {
            order.cancelled = true;
            order.status = 'Return';
            order.history.push({
              status: 'Return',
              timestamp: new Date().toISOString(),
              updatedBy: 'Velocity API',
              remarks: 'Consignment successfully cancelled via Velocity API.'
            });
            await db.saveOrder(order);
          }

          await db.addCourierLog({
            id: `cl-vel-cancel-${Date.now()}`,
            timestamp: new Date().toISOString(),
            courier: 'Velocity',
            action: 'Cancel Shipment',
            requestPayload: JSON.stringify({ awbs: [waybill] }, null, 2),
            responsePayload: JSON.stringify(cancelData, null, 2),
            status: 'Success'
          });

          return NextResponse.json(cancelData);
        } catch (err: any) {
          await db.addCourierLog({
            id: `cl-vel-cancel-fail-${Date.now()}`,
            timestamp: new Date().toISOString(),
            courier: 'Velocity',
            action: 'Cancel Shipment Failed',
            requestPayload: JSON.stringify({ awbs: [waybill] }, null, 2),
            responsePayload: JSON.stringify({ error: err.message || err }, null, 2),
            status: 'Error'
          });
          return NextResponse.json({ error: `Velocity cancellation failed: ${err.message}` }, { status: 500 });
        }
      }

      if (isXpressBees) {
        const xbConfig = resolveXpressBeesConfig(settings.xpressbeesConfig);
        let token = await getXpressBeesToken(xbConfig);
        const isMockToken = token === 'MOCK_TOKEN_12345';
        const baseUrl = xbConfig.baseUrl || 'https://shipment.xpressbees.com/api';

        if (isMockToken) {
          await db.addCourierLog({
            id: `cl-xb-cancel-${Date.now()}`,
            timestamp: new Date().toISOString(),
            courier: 'XpressBees',
            action: 'Cancel Shipment (Simulated)',
            requestPayload: JSON.stringify(body, null, 2),
            responsePayload: JSON.stringify({ status: true, message: 'Shipment cancellation simulated successfully.' }, null, 2),
            status: 'Success'
          });
          return NextResponse.json({ success: true, message: 'Cancellation simulated successfully.' });
        }

        const authType = xbConfig.authType || 'new';
        const cancelUrl = xbConfig.cancelUrl || 'https://clientshipupdatesapi.xbees.in/forwardcancellation';
        const targetCancelUrl = authType === 'new' ? cancelUrl : `${baseUrl}/shipments2/cancel`;

        const cancelRes = await fetch(targetCancelUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Token': token,
            'token': token,
            'TokenNumber': token,
            'XBKey': xbConfig.xbKey || '',
            'xb-key': xbConfig.xbKey || ''
          },
          body: JSON.stringify({ awb: waybill, awb_number: waybill, TokenNumber: token, Token: token })
        });
        const cancelData = await cancelRes.json();

        await db.addCourierLog({
          id: `cl-xb-cancel-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'XpressBees',
          action: 'Cancel Shipment',
          requestPayload: JSON.stringify({ awb: waybill, awb_number: waybill }, null, 2),
          responsePayload: JSON.stringify(cancelData, null, 2),
          status: cancelRes.ok && (authType === 'new' ? (cancelData.status === true || cancelData.ReturnCode === 100 || cancelRes.status === 200) : cancelData.status === true) ? 'Success' : 'Error'
        });

        return NextResponse.json(cancelData);
      } else if (isDtdc) {
        const apiKey = settings.dtdcConfig.apiKey;
        const isMockToken = apiKey.startsWith('MOCK') || apiKey.includes('tok_99store') || apiKey.includes('dummy');
        
        if (isMockToken) {
          const simulatedCancelResponse = {
            success: true,
            message: 'DTDC Shipment successfully cancelled (Simulated).'
          };
          await db.addCourierLog({
            id: `cl-dtdc-cancel-mock-${Date.now()}`,
            timestamp: new Date().toISOString(),
            courier: 'DTDC',
            action: 'Cancel Shipment (Simulated)',
            requestPayload: JSON.stringify(body, null, 2),
            responsePayload: JSON.stringify(simulatedCancelResponse, null, 2),
            status: 'Success'
          });
          return NextResponse.json(simulatedCancelResponse);
        }

        // Live DTDC Cancellation
        const isDemo = isDtdcStaging(apiKey);
        const dtdcBaseUrl = isDemo ? 'https://alphademodashboardapi.shipsy.io' : 'https://pxapi.dtdc.in';
        const cancelUrl = `${dtdcBaseUrl}/api/customer/integration/consignment/cancel`;
        const customerCode = settings.dtdcConfig.customerCode || 'MOCK_CUST';

        const cancelPayload = {
          AWBNo: [waybill],
          customerCode
        };

        try {
          const res = await fetch(cancelUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': apiKey
            },
            body: JSON.stringify(cancelPayload)
          });

          const responseText = await res.text();
          let cancelData;
          try {
            cancelData = JSON.parse(responseText);
          } catch (e) {
            cancelData = { error: responseText };
          }

          const isCancelSuccess = res.ok && (
            cancelData.success === true ||
            cancelData.status === 'OK' ||
            cancelData.status === 'success' ||
            (cancelData.data?.[0] && cancelData.data[0].success !== false)
          );

          if (isCancelSuccess) {
            const order = (await db.getOrders()).find(o => o.awb === waybill || o.dtdc_reference_number === waybill);
            if (order) {
              order.cancelled = true;
              order.status = 'Return';
              order.history.push({
                status: 'Return',
                timestamp: new Date().toISOString(),
                updatedBy: 'DTDC API',
                remarks: 'Consignment successfully cancelled via DTDC API.'
              });
              await db.saveOrder(order);
            }
          }

          await db.addCourierLog({
            id: `cl-dtdc-cancel-${Date.now()}`,
            timestamp: new Date().toISOString(),
            courier: 'DTDC',
            action: 'Cancel Shipment',
            requestPayload: JSON.stringify(cancelPayload, null, 2),
            responsePayload: JSON.stringify(cancelData, null, 2),
            status: isCancelSuccess ? 'Success' : 'Error'
          });

          return NextResponse.json(cancelData);
        } catch (err: any) {
          await db.addCourierLog({
            id: `cl-dtdc-cancel-fail-${Date.now()}`,
            timestamp: new Date().toISOString(),
            courier: 'DTDC',
            action: 'Cancel Shipment',
            requestPayload: JSON.stringify(cancelPayload, null, 2),
            responsePayload: JSON.stringify({ error: err.message || err }, null, 2),
            status: 'Error'
          });
          return NextResponse.json({ error: `DTDC cancellation API failed: ${err.message}` }, { status: 500 });
        }
      }
    }

    // 2. GENERATE MANIFEST
    if (action === 'manifest') {
      const { waybills } = body;
      if (!waybills || !Array.isArray(waybills)) {
        return NextResponse.json({ error: 'Missing awbs array for manifest generation.' }, { status: 400 });
      }

      const xbConfig = resolveXpressBeesConfig(settings.xpressbeesConfig);
      const token = await getXpressBeesToken(xbConfig);
      const isMockToken = token === 'MOCK_TOKEN_12345';
      const baseUrl = xbConfig.baseUrl || 'https://shipment.xpressbees.com/api';

      if (isMockToken) {
        await db.addCourierLog({
          id: `cl-xb-manifest-gen-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'XpressBees',
          action: 'Generate Manifest (Simulated)',
          requestPayload: JSON.stringify(body, null, 2),
          responsePayload: JSON.stringify({ status: true, message: 'Manifest created successfully (Simulated).' }, null, 2),
          status: 'Success'
        });
        return NextResponse.json({ success: true, message: 'Manifest simulated successfully.' });
      }

      const manifestRes = await fetch(`${baseUrl}/shipments2/manifest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Token': token,
          'token': token,
          'TokenNumber': token,
          'XBKey': xbConfig.xbKey || '',
          'xb-key': xbConfig.xbKey || ''
        },
        body: JSON.stringify({ awbs: waybills, TokenNumber: token, Token: token })
      });
      const manifestData = await manifestRes.json();

      await db.addCourierLog({
        id: `cl-xb-manifest-gen-${Date.now()}`,
        timestamp: new Date().toISOString(),
        courier: 'XpressBees',
        action: 'Generate Manifest',
        requestPayload: JSON.stringify({ awbs: waybills }, null, 2),
        responsePayload: JSON.stringify(manifestData, null, 2),
        status: manifestRes.ok && manifestData.status === true ? 'Success' : 'Error'
      });

      return NextResponse.json(manifestData);
    }

    // 3. REVERSE SHIPMENT
    if (action === 'reverse') {
      const { payload } = body;
      if (!payload) {
        return NextResponse.json({ error: 'Missing reverse shipment payload.' }, { status: 400 });
      }

      const xbConfig = resolveXpressBeesConfig(settings.xpressbeesConfig);
      const token = await getXpressBeesToken(xbConfig);
      const isMockToken = token === 'MOCK_TOKEN_12345';
      const baseUrl = xbConfig.baseUrl || 'https://shipment.xpressbees.com/api';

      if (isMockToken) {
        await db.addCourierLog({
          id: `cl-xb-reverse-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'XpressBees',
          action: 'Reverse Shipment (Simulated)',
          requestPayload: JSON.stringify(body, null, 2),
          responsePayload: JSON.stringify({ status: true, message: 'Reverse shipment simulated successfully.' }, null, 2),
          status: 'Success'
        });
        return NextResponse.json({ success: true, message: 'Reverse shipment simulated successfully.' });
      }

      const reverseRes = await fetch(`${baseUrl}/Reverseshipments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Token': token,
          'token': token,
          'TokenNumber': token,
          'XBKey': xbConfig.xbKey || '',
          'xb-key': xbConfig.xbKey || ''
        },
        body: JSON.stringify({ ...payload, TokenNumber: token, Token: token })
      });
      const reverseData = await reverseRes.json();

      await db.addCourierLog({
        id: `cl-xb-reverse-${Date.now()}`,
        timestamp: new Date().toISOString(),
        courier: 'XpressBees',
        action: 'Reverse Shipment',
        requestPayload: JSON.stringify(payload, null, 2),
        responsePayload: JSON.stringify(reverseData, null, 2),
        status: reverseRes.ok && reverseData.status === true ? 'Success' : 'Error'
      });

      return NextResponse.json(reverseData);
    }

    // 4. BOOK SHIPMENT (FORWARD)
    const { orderId, courier: rawCourier, weight, paymentType, codAmount, customerName, pincode } = body;

    if (!orderId || !rawCourier) {
      return NextResponse.json({ error: 'Missing orderId or courier selection.' }, { status: 400 });
    }

    const isXpressBeesBooking = rawCourier.toLowerCase().includes('xpressbees');
    const courier = isXpressBeesBooking ? 'XpressBees' : rawCourier;
    const requestedMode = body.accountOverride || body.mode || (rawCourier.toLowerCase().includes('surface') ? 'Surface' : (rawCourier.toLowerCase().includes('air') ? 'Air' : undefined));

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
        requestPayload: JSON.stringify(body, null, 2),
        responsePayload: JSON.stringify({ error: `${courier} integration is currently inactive in settings.` }, null, 2),
        status: 'Error'
      };
      await db.addCourierLog(failedLog);

      return NextResponse.json({ error: `${courier} Integration is disabled.` }, { status: 400 });
    }

    // LIVE XPRESSBEES BOOKING
    if (courier === 'XpressBees') {
      const xbConfig = resolveXpressBeesConfig(settings.xpressbeesConfig, requestedMode);
      const order = (await db.getOrders()).find(o => o.orderId.toLowerCase() === orderId.toLowerCase() || o.id === orderId);
      if (!order) {
        return NextResponse.json({ error: `Order with ID ${orderId} not found in database.` }, { status: 400 });
      }

      let token = 'MOCK_TOKEN_12345';
      try {
        token = await getXpressBeesToken(xbConfig);
      } catch (err: any) {
        const errorLog: CourierApiLog = {
          id: `cl-fail-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'XpressBees',
          action: 'Login / Generate AWB',
          requestPayload: JSON.stringify(body, null, 2),
          responsePayload: JSON.stringify({ error: `Authentication failed: ${err.message}` }, null, 2),
          status: 'Error'
        };
        await db.addCourierLog(errorLog);
        return NextResponse.json({ error: `XpressBees Authentication failed: ${err.message}` }, { status: 400 });
      }

      const isMockToken = token === 'MOCK_TOKEN_12345';
      const baseUrl = xbConfig.baseUrl || 'https://shipment.xpressbees.com/api';

      if (isMockToken) {
        // Fallback simulation
        const randomAwbSuffix = Math.floor(100000000 + Math.random() * 900000000).toString();
        const awb = `XB${randomAwbSuffix}`;
        const charge = 55 + (weight || order.weight) * 25 + (paymentType === 'COD' ? 35 : 0);
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
          requestPayload: JSON.stringify(body, null, 2),
          responsePayload: JSON.stringify(responsePayload, null, 2),
          status: 'Success'
        });

        order.awb = awb;
        order.courier = 'XpressBees';
        order.eta = etaString;
        order.updatedAt = new Date().toISOString();
        await db.saveOrder(order);

        return NextResponse.json({ success: true, awb, eta: etaString, courier: 'XpressBees', charge });
      }

      let finalAwb = '';
      const authType = xbConfig.authType || 'new';

      if (authType === 'new') {
        let cachedPool = settings.xpressbeesAwbPool || [];
        if (cachedPool.length > 0) {
          finalAwb = cachedPool.shift()!;
          settings.xpressbeesAwbPool = cachedPool;
          await db.saveSettings(settings);
          console.log(`[XpressBees] Pop AWB from pool: ${finalAwb}. Pool size remaining: ${cachedPool.length}`);

          // Trigger background replenishment if pool size is low (< 20)
          if (cachedPool.length < 20) {
            console.log(`[XpressBees] AWB pool size (${cachedPool.length}) is below 20. Replenishing in background...`);
            replenishAwbPool(settings, token).catch(err => {
              console.error("[XpressBees] Background replenish error:", err);
            });
          }
        } else {
          console.log("[XpressBees] AWB pool is empty. Fetching a new batch synchronously...");
          try {
            // Step 1: Generate AWB series batch ID
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

            // Auto-retry once with forced fresh token if XpressBees returns ReturnCode 101 (Invalid Token)
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
              return NextResponse.json({ error: `XpressBees AWB Series Generation failed: ${awbGenData.ReturnMessage || 'Invalid response'}` }, { status: 400 });
            }

            const batchId = awbGenData.BatchID;

            // Step 2: Retrieve the generated AWB numbers from batch ID
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
            // Truncate AWB list in log payload to avoid database file bloat
            const loggedRetrieveData = { ...awbRetrieveData };
            if (Array.isArray(loggedRetrieveData.AWBNoSeries) && loggedRetrieveData.AWBNoSeries.length > 5) {
              loggedRetrieveData.AWBNoSeries = [
                ...loggedRetrieveData.AWBNoSeries.slice(0, 5),
                `... and ${loggedRetrieveData.AWBNoSeries.length - 5} more AWB numbers (truncated to prevent bloat)`
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
              return NextResponse.json({ error: `XpressBees AWB Retrieval failed: ${awbRetrieveData.ReturnMessage || 'No AWB numbers returned'}` }, { status: 400 });
            }

            finalAwb = awbRetrieveData.AWBNoSeries[0];

            // Cache remaining AWBs in settings
            if (awbRetrieveData.AWBNoSeries.length > 1) {
              settings.xpressbeesAwbPool = awbRetrieveData.AWBNoSeries.slice(1);
              await db.saveSettings(settings);
              console.log(`[XpressBees] Cached ${settings.xpressbeesAwbPool?.length} AWB numbers in pool.`);
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
            return NextResponse.json({ error: `XpressBees AWB pre-generation flow error: ${err.message}` }, { status: 500 });
          }
        }
      }

      // Step 3: Manifest/Book shipment
      const weightInGrams = Math.round(Number(weight || order.weight || 0.5) * 1000);
      const serviceType = xbConfig.serviceType || 'NDD';
      const vendorCode = xbConfig.vendorCode || 'VEND001';

      const cleanConsigneePhone = (order.phonePrimary || '').replace(/\D/g, '').slice(-10) || '9999999999';
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
        bookingPayload.Weight = Number(order.weight || 0.5);
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

        // Auto-retry once with forced fresh token if Forward Manifesting returns ReturnCode 101 (Invalid Token)
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
        const charge = 55 + (weight || order.weight) * 25 + (paymentType === 'COD' ? 35 : 0);

        order.awb = finalAwb;
        order.courier = 'XpressBees';
        order.eta = etaString;
        order.updatedAt = new Date().toISOString();

        if (isMockFallback) {
          order.history.push({
            status: 'Label Generated',
            timestamp: new Date().toISOString(),
            updatedBy: 'system',
            remarks: `AWB ${finalAwb} generated via fallback. (Original API returned: ${bookingResponseData.message || bookingResponseData.ReturnMessage || responseText})`
          });
        }
        await db.saveOrder(order);

        return NextResponse.json({ 
          success: true, 
          awb: finalAwb, 
          eta: etaString, 
          courier: 'XpressBees', 
          charge,
          note: isMockFallback ? `Mock Fallback activated due to XpressBees API error: ${bookingResponseData.message || bookingResponseData.ReturnMessage || responseText}` : undefined
        });

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
        return NextResponse.json({ error: `XpressBees booking network error: ${err.message}` }, { status: 500 });
      }
    }

    if (courier === 'Velocity' || courier === 'Aggregator') {
      const order = (await db.getOrders()).find(o => o.orderId.toLowerCase() === orderId.toLowerCase() || o.id === orderId);
      if (!order) {
        return NextResponse.json({ error: `Order with ID ${orderId} not found in database.` }, { status: 400 });
      }

      try {
        const bookData = await bookVelocityOrder(order, settings, weight, paymentType);
        
        order.awb = bookData.awb;
        order.courier = courier;
        order.eta = bookData.eta;
        order.velocity_label_url = bookData.label_url;
        order.velocity_shipment_id = bookData.shipment_id;
        order.updatedAt = new Date().toISOString();
        
        await db.saveOrder(order);

        await db.addCourierLog({
          id: `cl-vel-book-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'Velocity',
          action: 'Create Shipment',
          requestPayload: JSON.stringify(body, null, 2),
          responsePayload: JSON.stringify(bookData, null, 2),
          status: 'Success'
        });

        return NextResponse.json({
          success: true,
          awb: bookData.awb,
          eta: bookData.eta,
          courier: courier,
          charge: bookData.charge
        });
      } catch (err: any) {
        await db.addCourierLog({
          id: `cl-vel-book-fail-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'Velocity',
          action: 'Create Shipment Failed',
          requestPayload: JSON.stringify(body, null, 2),
          responsePayload: JSON.stringify({ error: err.message || err }, null, 2),
          status: 'Error'
        });
        return NextResponse.json({ error: `Velocity booking failed: ${err.message}` }, { status: 500 });
      }
    }

    if (courier === 'DTDC') {
      const order = (await db.getOrders()).find(o => o.orderId.toLowerCase() === orderId.toLowerCase() || o.id === orderId);
      if (!order) {
        return NextResponse.json({ error: `Order with ID ${orderId} not found in database.` }, { status: 400 });
      }

      const isMockToken = apiKey.startsWith('MOCK') || apiKey.includes('tok_99store') || apiKey.includes('dummy');
      
      if (isMockToken) {
        const randomAwbSuffix = Math.floor(100000000 + Math.random() * 900000000).toString();
        const awb = `DTDC${randomAwbSuffix}`;
        const etaDays = 3;
        const etaDate = new Date();
        etaDate.setDate(etaDate.getDate() + etaDays);
        const etaString = etaDate.toISOString().split('T')[0];
        const charge = 60 + (weight || order.weight || 0.5) * 30 + (paymentType === 'COD' ? 40 : 0);

        await db.addCourierLog({
          id: `cl-success-mock-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'DTDC',
          action: 'Generate AWB (Simulated)',
          requestPayload: JSON.stringify(body, null, 2),
          responsePayload: JSON.stringify({ success: true, awb, eta: etaString, charge }, null, 2),
          status: 'Success'
        });

        return NextResponse.json({ success: true, awb, eta: etaString, courier: 'DTDC', charge });
      }

      // Live DTDC softdata booking
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
        weight: weight ? String(weight) : String(order.weight || '0.5'),
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
          phone: order.phonePrimary,
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
          return NextResponse.json({ error: `DTDC Booking failed: ${bookData.message || responseText}` }, { status: 400 });
        }

        const cons = bookData.data?.consignments?.[0] || bookData.consignments?.[0] || bookData.data?.[0];
        const finalAwb = cons?.courier_partner_reference_number || cons?.reference_number || cons?.awb || '';
        
        if (!finalAwb) {
          return NextResponse.json({ error: `DTDC Booking succeeded but no AWB was allocated: ${JSON.stringify(bookData)}` }, { status: 400 });
        }

        order.awb = finalAwb;
        order.dtdc_reference_number = finalAwb;
        order.current_status = 'Softdata Uploaded';
        order.current_status_code = 'BOOKED';
        order.last_tracking_update = new Date().toISOString();
        order.label_generated = false;
        order.cancelled = false;
        await db.saveOrder(order);

        const etaDays = 3;
        const etaDate = new Date();
        etaDate.setDate(etaDate.getDate() + etaDays);
        const etaString = etaDate.toISOString().split('T')[0];
        const charge = 60 + (weight || order.weight || 0.5) * 30 + (paymentType === 'COD' ? 40 : 0);

        return NextResponse.json({ success: true, awb: finalAwb, eta: etaString, courier: 'DTDC', charge });
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
        return NextResponse.json({ error: `DTDC Booking network error: ${err.message}` }, { status: 500 });
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

      const order = (await db.getOrders()).find(o => o.orderId.toLowerCase() === orderId.toLowerCase() || o.id === orderId);
      if (!order) {
        return NextResponse.json({ error: `Order with ID ${orderId} not found in database.` }, { status: 400 });
      }

      if (isMockToken) {
        const randomAwbSuffix = Math.floor(100000000 + Math.random() * 900000000).toString();
        const awb = `99SDEL${randomAwbSuffix}`;
        const etaDays = 3;
        const etaDate = new Date();
        etaDate.setDate(etaDate.getDate() + etaDays);
        const etaString = etaDate.toISOString().split('T')[0];
        const charge = 70 + (weight || order.weight || 0.5) * 20 + (paymentType === 'COD' ? 30 : 0);

        await db.addCourierLog({
          id: `cl-cmu-manifest-mock-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'Delhivery',
          action: 'Create Shipment (Simulated)',
          requestPayload: JSON.stringify(body, null, 2),
          responsePayload: JSON.stringify({
            success: true,
            packages: [{ waybill: awb }],
            eta: etaString,
            charge
          }, null, 2),
          status: 'Success'
        });

        return NextResponse.json({ success: true, awb, eta: etaString, courier: 'Delhivery', charge });
      }

      // Step A: Fetch Live Waybill (AWB) from Delhivery API
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

      // Step B: Create CMU Manifest Shipment
      const paymentMode = (order.paymentType === 'COD' || (order.partiallyPaidAmount !== undefined && order.partiallyPaidAmount > 0 && order.orderValue > order.partiallyPaidAmount)) ? 'COD' : 'Prepaid';

      const shipment: any = {
        name: order.customerName,
        add: order.address,
        pin: order.pincode,
        city: order.area || 'New Delhi',
        state: order.state || 'Delhi',
        country: 'India',
        phone: order.phonePrimary,
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
        weight: String(Math.round(Number(weight || order.weight || 0.5) * 1000)),
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
          return NextResponse.json({ error: `Delhivery CMU Manifest failed: ${errorMsg}` }, { status: 400 });
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
        return NextResponse.json({ error: `Delhivery CMU Manifest network error: ${err.message}` }, { status: 500 });
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

      return NextResponse.json({ success: true, awb: finalAwb, eta: etaString, courier: 'Delhivery', charge });
    }

    // Default simulated AWB generation (for DTDC / Aggregator)
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
      requestPayload: JSON.stringify(body, null, 2),
      responsePayload: JSON.stringify(responsePayload, null, 2),
      status: 'Success'
    };
    await db.addCourierLog(successLog);

    return NextResponse.json({ success: true, awb, eta: etaString, courier, charge });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Courier API execution failed.' }, { status: 500 });
  }
}
