import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { NdrRecord } from '@/lib/types';
import { triggerWhatsAppNotification } from '@/lib/whatsapp';
import { getXpressBeesToken } from '@/lib/xpressbees';

export async function GET() {
  try {
    const records = await db.getNdrRecords();
    // Sort so most recent NDRs are at the top
    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ success: true, records });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch NDR records.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, status, reattemptDate, internalNotes, actionRemarks, updatedBy } = body;

    if (!id || !status || !updatedBy) {
      return NextResponse.json({ error: 'Missing required NDR update fields.' }, { status: 400 });
    }

    const record = await db.getNdrRecordById(id);
    if (!record) {
      return NextResponse.json({ error: 'NDR record not found.' }, { status: 404 });
    }

    const previousStatus = record.status;
    const now = new Date().toISOString();

    record.status = status;
    record.updatedAt = now;
    if (reattemptDate) record.reattemptDate = reattemptDate;
    if (internalNotes) record.internalNotes = internalNotes;

    // Append to NDR history
    record.history.push({
      action: `Status Update: ${status}`,
      timestamp: now,
      remarks: actionRemarks || `NDR status changed from ${previousStatus} to ${status} by ${updatedBy}.`
    });

    await db.saveNdrRecord(record);

    // Dynamic closed-loop workflow logic:
    // If a re-attempt is scheduled, we also update the main Order status back to "Dispatched"
    // to simulate logistics re-attempting delivery.
    if (status === 'Re-attempt Scheduled') {
      const order = await db.getOrderByOrderId(record.orderId);
      if (order) {
        order.status = 'Dispatched';
        order.updatedAt = now;
        order.history.push({
          status: 'Dispatched',
          timestamp: now,
          updatedBy,
          remarks: `Delivery re-attempt scheduled for ${reattemptDate}. NDR Escalation closed.`
        });
        await db.saveOrder(order);

        // XpressBees Escalation integration call if live
        if (order.courier === 'XpressBees' && order.awb) {
          const settings = await db.getSettings();
          const email = settings.xpressbeesConfig.email;
          const password = settings.xpressbeesConfig.password;
          const baseUrl = settings.xpressbeesConfig.baseUrl || 'https://shipment.xpressbees.com/api';
          const isMock = !email || email.includes('example.com') || email.startsWith('your-') || email.includes('mock');

          if (!isMock && settings.xpressbeesActive) {
            // Background call to XpressBees to schedule re-attempt
            try {
              // 1. Get cached/fresh token
              const token = await getXpressBeesToken(settings.xpressbeesConfig);
              const authType = settings.xpressbeesConfig.authType || 'new';
              const ndrUrl = settings.xpressbeesConfig.ndrUrl || 'https://clientshipupdatesapi.xbees.in/client/UpdateNDRDeferredDeliveryDate';
              
              let targetNdrUrl;
              let ndrPayload;
              let headersObj: any = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              };

              if (authType === 'new') {
                targetNdrUrl = ndrUrl;
                headersObj['XBKey'] = settings.xpressbeesConfig.xbKey || '';
                ndrPayload = {
                  awb: order.awb,
                  awb_number: order.awb,
                  deferred_date: reattemptDate || new Date().toISOString().split('T')[0],
                  deferredDate: reattemptDate || new Date().toISOString().split('T')[0],
                  re_attempt_date: reattemptDate || new Date().toISOString().split('T')[0]
                };
              } else {
                targetNdrUrl = `${baseUrl}/ndr/create`;
                ndrPayload = [
                  {
                    awb: order.awb,
                    action: "re-attempt",
                    action_data: {
                      re_attempt_date: reattemptDate || new Date().toISOString().split('T')[0]
                    }
                  }
                ];
              }

              const ndrRes = await fetch(targetNdrUrl, {
                method: 'POST',
                headers: headersObj,
                body: JSON.stringify(ndrPayload)
              });
              const ndrResponseData = await ndrRes.json();

              await db.addCourierLog({
                id: `cl-ndr-action-${Date.now()}`,
                timestamp: new Date().toISOString(),
                courier: 'XpressBees',
                action: 'NDR Resolve (Re-attempt)',
                requestPayload: JSON.stringify(ndrPayload, null, 2),
                responsePayload: JSON.stringify(ndrResponseData, null, 2),
                status: ndrRes.ok && (authType === 'new' ? (ndrResponseData.status === true || ndrResponseData.ReturnCode === 100 || ndrRes.status === 200) : ndrResponseData.status === true) ? 'Success' : 'Error'
              });
            } catch (err: any) {
              console.error('Failed to resolve NDR live with XpressBees:', err);
              await db.addCourierLog({
                id: `cl-ndr-action-fail-${Date.now()}`,
                timestamp: new Date().toISOString(),
                courier: 'XpressBees',
                action: 'NDR Resolve (Re-attempt)',
                requestPayload: JSON.stringify({ awb: order.awb, reattemptDate }, null, 2),
                responsePayload: JSON.stringify({ error: err.message || err }, null, 2),
                status: 'Error'
              });
            }
          } else {
            // Simulated log
            await db.addCourierLog({
              id: `cl-ndr-action-mock-${Date.now()}`,
              timestamp: new Date().toISOString(),
              courier: 'XpressBees',
              action: 'NDR Resolve (Re-attempt - Simulated)',
              requestPayload: JSON.stringify({ awb: order.awb, reattemptDate }, null, 2),
              responsePayload: JSON.stringify({ status: true, message: 'NDR action updated successfully (Simulated).' }, null, 2),
              status: 'Success'
            });
          }
        }

        // Trigger real WhatsApp in background directly, bypassing loopback network dependencies
        triggerWhatsAppNotification({
          orderId: order.orderId,
          customerName: order.customerName,
          phonePrimary: order.phonePrimary,
          phoneSecondary: order.phoneSecondary,
          status: 'Dispatched',
          awb: order.awb || 'N/A',
          courier: order.courier || 'N/A',
          eta: reattemptDate || order.eta || 'N/A',
          orderValue: order.orderValue,
          paymentType: order.paymentType
        }).catch(err => console.error('Failed to trigger background direct WhatsApp:', err));
      }
    } else if (status === 'Returned to Origin') {
      const order = await db.getOrderByOrderId(record.orderId);
      if (order) {
        order.status = 'Return';
        order.updatedAt = now;
        order.history.push({
          status: 'Return',
          timestamp: now,
          updatedBy,
          remarks: `NDR Escalation marked as Return to Origin (RTO) by ${updatedBy}. Package returning.`
        });
        await db.saveOrder(order);
      }
    }

    return NextResponse.json({ success: true, record });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update NDR record.' }, { status: 500 });
  }
}
