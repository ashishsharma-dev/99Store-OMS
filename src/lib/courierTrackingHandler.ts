import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getXpressBeesToken, resolveXpressBeesConfig } from '@/lib/xpressbees';
import { syncOrderStatus, mapCourierStatusToInternal } from '@/lib/courierSync';
import { isDtdcStaging } from '@/lib/courierHelper';
import { isCourierSimulationEnabled } from '@/lib/courierReliability';
import { trackShadowfaxOrder } from '@/lib/shadowfax';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getLatestDelhiveryScan } from '@/lib/delhiveryTracking';
import { DtdcTrackingError, trackDtdcShipment } from '@/lib/dtdcTracking';

async function syncTrackedStatus(...args: Parameters<typeof syncOrderStatus>) {
  const result = await syncOrderStatus(...args);
  if (result.error) throw new Error(result.error);
  return result;
}

export async function handleCourierTracking(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const waybill = searchParams.get('waybill');
    const queryCourier = searchParams.get('courier');

    if (!action || !waybill) {
      return NextResponse.json({ error: 'Missing action or waybill parameter.' }, { status: 400 });
    }

    const settings = await db.getSettings();

    const isXpressBees = queryCourier === 'XpressBees' || waybill.startsWith('XB') || waybill.startsWith('5963');
    const isDtdc = queryCourier === 'DTDC' || waybill.startsWith('DTDC');
    const isShadowfax = queryCourier === 'Shadowfax' || waybill.startsWith('SFX') || waybill.startsWith('SF') || (await db.getOrders()).some(o => o.awb === waybill && o.courier === 'Shadowfax');

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
          await syncTrackedStatus(waybill, courierStatus, scanLocation, customRemarks);

          return NextResponse.json(simulatedTracking);
        }

        const authType = xbConfig.authType || 'new';
        let res;
        let data;
        let reqPayloadStr = '';

        if (authType === 'new') {
          const trackUrl = xbConfig.trackBulkUrl || 'https://apishipmenttracking.xbees.in/GetCurrentShipmentStatus';
          reqPayloadStr = `POST ${trackUrl} body: { AWBNumber: ${waybill} }`;
          res = await fetchWithRetry(
            trackUrl,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Token': token,
                'TokenNumber': token,
                'XBKey': xbConfig.xbKey || '',
                'versionnumber': 'v1'
              },
              body: JSON.stringify({
                AWBNumber: waybill
              })
            },
            {
              awb: waybill,
              courierName: 'XpressBees',
              timeoutMs: 10000,
              maxAttempts: 3
            }
          );
          data = await res.json();
        } else {
          reqPayloadStr = `GET ${baseUrl}/shipments2/track/${waybill}`;
          res = await fetchWithRetry(
            `${baseUrl}/shipments2/track/${encodeURIComponent(waybill)}`,
            {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            },
            {
              awb: waybill,
              courierName: 'XpressBees',
              timeoutMs: 10000,
              maxAttempts: 3
            }
          );
          data = await res.json();
        }

        let unifiedData = data;

        // Handle new-style XpressBees response: [{AWBNO, ReturnCode, ReturnMessage, CurrentShipmentStatus}]
        const xbArr = Array.isArray(data) ? data : null;
        const xbEntry = xbArr?.[0];
        if (xbEntry && 'ReturnCode' in xbEntry) {
          if (String(xbEntry.ReturnCode) !== '100') {
            await db.addCourierLog({
              id: `cl-xb-track-${Date.now()}`,
              timestamp: new Date().toISOString(),
              courier: 'XpressBees',
              action: 'Track Shipment',
              requestPayload: reqPayloadStr,
              responsePayload: JSON.stringify(data, null, 2),
              status: 'Error'
            });
            return NextResponse.json({ error: `XpressBees tracking error: ${xbEntry.ReturnMessage || 'Unknown error'} (code ${xbEntry.ReturnCode})` }, { status: 502 });
          }
          const css = xbEntry.CurrentShipmentStatus;
          unifiedData = {
            ShipmentData: [
              {
                Shipment: {
                  AWB: xbEntry.AWBNO || waybill,
                  Status: {
                    Status: css?.Status || '',
                    StatusLocation: css?.CurrentLocation || css?.OriginLocation || 'Hub',
                    StatusDateTime: css?.StatusDateTime || ''
                  },
                  Scans: css ? [{
                    ScanDetail: {
                      ScannedLocation: css.CurrentLocation || css.OriginLocation || 'Hub',
                      ScanDateTime: css.StatusDateTime || '',
                      Scan: css.Status || 'Scan Recorded',
                      Instructions: css.Remark || ''
                    }
                  }] : []
                }
              }
            ]
          };
        } else if (data && !data.ShipmentData) {
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
                            '';
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
                      ScanDateTime: s.date || s.time || s.activity_date || s.scanDateTime || '',
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
        const latestScan = getLatestDelhiveryScan(unifiedData?.ShipmentData?.[0]?.Shipment?.Scans);
        const customRemarks = latestScan ? `${latestScan.Scan}. Remarks: ${latestScan.Instructions}` : undefined;
        if (courierStatus || latestScan?.Scan) {
          await syncTrackedStatus(waybill, (mapCourierStatusToInternal(latestScan?.Scan) ? latestScan?.Scan : courierStatus) || courierStatus, latestScan?.ScannedLocation || scanLocation, customRemarks, liveEta, latestScan?.StatusDateTime || latestScan?.ScanDateTime);
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
          await syncTrackedStatus(waybill, 'Out for Delivery', 'Delhi Hub', customRemarks);
          return NextResponse.json(simulatedTracking);
        }

        const username = settings.dtdcConfig.username || '';
        const password = settings.dtdcConfig.password || '';
        const isStaging = isDtdcStaging(apiKey, username);

        try {
          const trackingResult = await trackDtdcShipment({
            waybill,
            username,
            password,
            configuredAccessToken: settings.dtdcConfig.accessToken,
            isStaging,
          });
          const { data: trackData, requestPayload: trackPayload, requestUrl: trackDetailsUrl } = trackingResult;

          await db.addCourierLog({
            id: `cl-dtdc-track-${Date.now()}`,
            timestamp: new Date().toISOString(),
            courier: 'DTDC',
            action: 'Track Shipment',
            requestPayload: `POST ${trackDetailsUrl}\nPayload: ${JSON.stringify(trackPayload)}`,
            responsePayload: JSON.stringify(trackData, null, 2),
            status: 'Success'
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
                                '';
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
                      ScanDateTime: s.statusDate ? `${s.statusDate}T${s.statusTime || '00:00:00'}` : '',
                      Scan: s.activity || s.status || 'Scan Recorded',
                      Instructions: s.remarks || s.instructions || ''
                    }
                  }))
                }
              }
            ]
          };

          const liveEta = trackData?.expected_delivery_date || trackData?.expectedDeliveryDate || trackData?.edd || (trackData?.data && (trackData.data.expected_delivery_date || trackData.data.expectedDeliveryDate)) || null;
          const latestScan = getLatestDelhiveryScan(unifiedData?.ShipmentData?.[0]?.Shipment?.Scans);
          const customRemarks = latestScan ? `${latestScan.Scan}. Remarks: ${latestScan.Instructions}` : undefined;
          if (currentStatus || latestScan?.Scan) {
            await syncTrackedStatus(waybill, (mapCourierStatusToInternal(latestScan?.Scan) ? latestScan?.Scan : currentStatus) || currentStatus, latestScan?.ScannedLocation || currentLocation, customRemarks, liveEta, latestScan?.StatusDateTime || latestScan?.ScanDateTime);
          }

          return NextResponse.json(unifiedData);
        } catch (err: any) {
          const message = err instanceof DtdcTrackingError
            ? err.message
            : `DTDC tracking service is unavailable: ${err.message}`;
          await db.addCourierLog({
            id: `cl-dtdc-track-${Date.now()}`,
            timestamp: new Date().toISOString(),
            courier: 'DTDC',
            action: 'Track Shipment',
            requestPayload: `Tracking request for AWB ${waybill}`,
            responsePayload: JSON.stringify({
              error: message,
              upstreamStatus: err instanceof DtdcTrackingError ? err.upstreamStatus : undefined,
            }, null, 2),
            status: 'Error'
          });
          return NextResponse.json({ error: message }, { status: 502 });
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

    if (isShadowfax) {
      if (!settings.shadowfaxActive) {
        return NextResponse.json({ error: 'Shadowfax integration is disabled in settings.' }, { status: 400 });
      }

      if (action === 'track') {
        try {
          const res = await trackShadowfaxOrder(waybill, settings.shadowfaxConfig);
          if (!res.success) return NextResponse.json({ error: res.error || 'Shadowfax tracking unavailable.' }, { status: 502 });
          const trackData = res.data || {};

          await db.addCourierLog({
            id: `cl-sfx-track-${Date.now()}`,
            timestamp: new Date().toISOString(),
            courier: 'Shadowfax',
            action: 'Track Shipment',
            requestPayload: `GET /v4/clients/orders/${waybill}/track/`,
            responsePayload: JSON.stringify(res, null, 2),
            status: res.success ? 'Success' : 'Error'
          });

          const currentStatus = trackData.status || trackData.current_status || '';
          const currentLocation = trackData.current_location || trackData.location || 'Hub';
          const comments = trackData.comments || '';
          const rawScans = Array.isArray(trackData.tracking_details)
            ? trackData.tracking_details
            : (Array.isArray(trackData.tracking_history) 
              ? trackData.tracking_history 
              : (Array.isArray(trackData.scans) ? trackData.scans : []));

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
                      ScannedLocation: s.location || currentLocation,
                      ScanDateTime: s.created || s.time || s.timestamp || '',
                      Scan: s.status || s.status_id || s.event || 'Scan Recorded',
                      Instructions: s.remarks || s.description || s.comments || ''
                    }
                  }))
                }
              }
            ]
          };

          {
            const latest = getLatestDelhiveryScan(unifiedData.ShipmentData[0].Shipment.Scans);
            if (latest?.Scan || currentStatus) await syncTrackedStatus(waybill, latest?.Scan || currentStatus, latest?.ScannedLocation || currentLocation, latest?.Instructions || comments, undefined, latest?.ScanDateTime);
          }

          return NextResponse.json(unifiedData);
        } catch (err: any) {
          return NextResponse.json({ error: `Shadowfax tracking failed: ${err.message}` }, { status: 500 });
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

        await syncTrackedStatus(waybill, targetStatus, targetLocation, targetRemarks);
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
      const res = await fetchWithRetry(
        url,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        },
        {
          awb: waybill,
          courierName: 'Delhivery',
          timeoutMs: 10000,
          maxAttempts: 3
        }
      );
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
      const latestScan = getLatestDelhiveryScan(data?.ShipmentData?.[0]?.Shipment?.Scans);
      const statusObj = data?.ShipmentData?.[0]?.Shipment?.Status;
      const customRemarks = `Current Status: "${statusObj?.Status}" [Type: ${statusObj?.StatusType || 'UD'}, Instructions: ${statusObj?.Instructions || ''}]. Latest Scan: ${latestScan ? `${latestScan.Scan} (${latestScan.Instructions})` : 'None'}`;
      if (courierStatus) {
        await syncTrackedStatus(waybill, courierStatus, scanLocation, customRemarks, liveEta, statusObj?.StatusDateTime || latestScan?.StatusDateTime || latestScan?.ScanDateTime);
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

