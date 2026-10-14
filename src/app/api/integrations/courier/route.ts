import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CourierApiLog } from '@/lib/types';
import { getXpressBeesToken, resolveXpressBeesConfig } from '@/lib/xpressbees';
import { isDtdcStaging } from '@/lib/courierHelper';
import { bookOrderCourierShipment, isCourierSimulationEnabled, validateManifestWaybills } from '@/lib/courierReliability';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getActiveSession } from '@/lib/authorization';

import { handleCourierTracking } from '@/lib/courierTrackingHandler';

export async function GET(request: Request) {
  if (!await getActiveSession(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return handleCourierTracking(request);
}

export async function POST(request: Request) {
  try {
    if (!await getActiveSession(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const body = await request.json();
    const action = body.action || 'book'; // 'book' | 'cancel' | 'manifest' | 'reverse'
    const settings = await db.getSettings();

    // 1. CANCEL SHIPMENT
    if (action === 'cancel') {
      const { waybill, courier } = body;
      if (!waybill) {
        return NextResponse.json({ error: 'Missing AWB waybill parameter for cancellation.' }, { status: 400 });
      }

      const isXpressBees = courier === 'XpressBees' || waybill.startsWith('XB');
      const isDtdc = courier === 'DTDC' || waybill.startsWith('DTDC');
      const isShadowfax = courier === 'Shadowfax' || waybill.startsWith('SFX') || waybill.startsWith('SF');

      if (isXpressBees) {
        const xbConfig = resolveXpressBeesConfig(settings.xpressbeesConfig);
        const token = await getXpressBeesToken(xbConfig);
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
      } else if (isShadowfax) {
        const order = (await db.getOrders()).find(o => o.awb === waybill);
        if (order) {
          order.cancelled = true;
          order.status = 'Return';
          order.history.push({
            status: 'Return',
            timestamp: new Date().toISOString(),
            updatedBy: 'Shadowfax API',
            remarks: 'Shipment cancellation recorded.'
          });
          await db.saveOrder(order);
        }

        await db.addCourierLog({
          id: `cl-sfx-cancel-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'Shadowfax',
          action: 'Cancel Shipment',
          requestPayload: JSON.stringify({ waybill }, null, 2),
          responsePayload: JSON.stringify({ success: true, message: 'Shadowfax order cancelled' }, null, 2),
          status: 'Success'
        });

        return NextResponse.json({ success: true, message: 'Shadowfax consignment cancelled.' });
      }
    }

    // 2. GENERATE MANIFEST
    if (action === 'manifest') {
      const { waybills } = body;
      const manifestValidation = validateManifestWaybills(waybills, await db.getOrders());
      if (!manifestValidation.valid) {
        return NextResponse.json({ error: manifestValidation.error }, { status: 400 });
      }
      const validatedWaybills = manifestValidation.waybills;

      const xbConfig = resolveXpressBeesConfig(settings.xpressbeesConfig);
      const token = await getXpressBeesToken(xbConfig);
      const isMockToken = token === 'MOCK_TOKEN_12345';
      const baseUrl = xbConfig.baseUrl || 'https://shipment.xpressbees.com/api';

      if (isMockToken) {
        if (!isCourierSimulationEnabled()) {
          return NextResponse.json(
            { error: 'XpressBees credentials are missing or configured as placeholders. Manifest simulation is disabled.' },
            { status: 400 },
          );
        }
        await db.addCourierLog({
          id: `cl-xb-manifest-gen-${Date.now()}`,
          timestamp: new Date().toISOString(),
          courier: 'XpressBees',
          action: 'Generate Manifest (Simulated)',
          requestPayload: JSON.stringify({ awbs: validatedWaybills }, null, 2),
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
        body: JSON.stringify({ awbs: validatedWaybills, TokenNumber: token, Token: token })
      });
      const manifestData = await manifestRes.json();

      await db.addCourierLog({
        id: `cl-xb-manifest-gen-${Date.now()}`,
        timestamp: new Date().toISOString(),
        courier: 'XpressBees',
        action: 'Generate Manifest',
        requestPayload: JSON.stringify({ awbs: validatedWaybills }, null, 2),
        responsePayload: JSON.stringify(manifestData, null, 2),
        status: manifestRes.ok && manifestData.status === true ? 'Success' : 'Error'
      });

      const manifestSucceeded = manifestRes.ok && manifestData.status === true;
      if (!manifestSucceeded) {
        return NextResponse.json(
          { error: manifestData.message || manifestData.error || 'XpressBees manifest generation failed.', details: manifestData },
          { status: 502 },
        );
      }

      return NextResponse.json({ ...manifestData, submittedWaybills: validatedWaybills });
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

    const result = await bookOrderCourierShipment(
      order,
      settings,
      {
        weight: body.weight,
        courier: rawCourier,
        phone: body.phoneOverride || order.phonePrimary,
        mode: body.mode || body.accountOverride,
      },
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
      order.updatedAt = new Date().toISOString();
      order.courierBookingStatus = 'Booked';
      order.courierBookingError = undefined;
      order.courierBookingCompletedAt = new Date().toISOString();
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
      const status = result.reconciliationRequired || result.error?.includes('already in progress') ? 409 : 400;
      return NextResponse.json({ error: result.error || 'Courier booking failed.', reconciliationRequired: result.reconciliationRequired }, { status });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Courier API execution failed.' }, { status: 500 });
  }
}
