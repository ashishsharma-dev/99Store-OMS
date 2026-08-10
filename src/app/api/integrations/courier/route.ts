import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CourierApiLog } from '@/lib/types';
import { getXpressBeesToken, resolveXpressBeesConfig } from '@/lib/xpressbees';
import { syncOrderStatus } from '@/lib/courierSync';
import { trackVelocityShipment, cancelVelocityShipment } from '@/lib/velocity';
import { bookCourierShipment, isDtdcStaging } from '@/lib/courierHelper';

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

          const courierStatus = simulatedTracking.ShipmentData[0].Shipment.Status.Status;
          const scanLocation = simulatedTracking.ShipmentData[0].Shipment.Status.StatusLocation;
          const latestScan = simulatedTracking.ShipmentData[0].Shipment.Scans?.[0]?.ScanDetail;
          const customRemarks = latestScan ? `${latestScan.Scan}. Remarks: ${latestScan.Instructions}` : undefined;
          await syncOrderStatus(waybill, courierStatus, scanLocation, customRemarks);

          return NextResponse.json(simulatedTracking);
        }

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

          const rawScans = Array.isArray(trackData) 
            ? trackData 
            : Array.isArray(trackData.scans) 
              ? trackData.scans 
              : Array.isArray(trackData.data) 
                ? trackData.data 
                : (trackData.history || []);
                
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
    const { orderId, courier: rawCourier } = body;

    if (!orderId || !rawCourier) {
      return NextResponse.json({ error: 'Missing orderId or courier selection.' }, { status: 400 });
    }

    const order = (await db.getOrders()).find(o => o.orderId.toLowerCase() === orderId.toLowerCase() || o.id === orderId);
    if (!order) {
      return NextResponse.json({ error: `Order with ID ${orderId} not found in database.` }, { status: 400 });
    }

    const result = await bookCourierShipment(
      order,
      settings,
      body.weight,
      rawCourier,
      body.phoneOverride,
      body.mode || body.accountOverride
    );

    if (result.success) {
      if (result.awb) {
        order.awb = result.awb;
      }
      if (result.eta) {
        order.eta = result.eta;
      }
      if (result.courier) {
        order.courier = result.courier as any;
      }
      if (result.velocity_label_url) {
        order.velocity_label_url = result.velocity_label_url;
      }
      if (result.velocity_shipment_id) {
        order.velocity_shipment_id = result.velocity_shipment_id;
      }
      order.updatedAt = new Date().toISOString();
      await db.saveOrder(order);

      return NextResponse.json({
        success: true,
        awb: result.awb,
        eta: result.eta,
        courier: result.courier,
        charge: result.charge,
        note: result.note
      });
    } else {
      return NextResponse.json({ error: result.error || 'Courier booking failed.' }, { status: 400 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Courier API execution failed.' }, { status: 500 });
  }
}
