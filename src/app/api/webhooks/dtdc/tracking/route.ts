import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncOrderStatus } from '@/lib/courierSync';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Extract Tracking Identifiers & Event details
    const awb =
      body.reference_no ||
      body.reference_number ||
      body.courier_partner_reference_number ||
      body.awb ||
      body.shipment ||
      body.strcnno ||
      '';

    const customerReference =
      body.customer_reference_no ||
      body.customer_reference_number ||
      body.orderId ||
      '';

    const statusCode =
      body.event_code ||
      body.status_code ||
      body.status ||
      '';

    const statusName =
      body.event_name ||
      body.status_name ||
      body.current_status ||
      body.status_description ||
      '';

    const location =
      body.event_location ||
      body.location ||
      body.activity_office ||
      '';

    const remarks =
      body.event_remarks ||
      body.remarks ||
      body.instructions ||
      '';

    const dateVal =
      body.event_date ||
      body.date ||
      new Date().toISOString().split('T')[0];

    const timeVal =
      body.event_time ||
      body.time ||
      new Date().toTimeString().split(' ')[0];

    const latitude =
      body.latitude ||
      body.lat ||
      '';

    const longitude =
      body.longitude ||
      body.lng ||
      '';

    // Log tracking event in tracking_events database collection
    const trackingEvent = {
      shipment: String(awb || customerReference),
      status_code: String(statusCode),
      status_name: String(statusName),
      location: String(location),
      remarks: String(remarks),
      date: String(dateVal),
      time: String(timeVal),
      lat: String(latitude),
      lng: String(longitude)
    };

    await db.addTrackingEvent(trackingEvent);

    // 2. Locate order in database
    const orders = await db.getOrders();
    const order = orders.find(
      o =>
        (awb && o.awb && o.awb.trim().toLowerCase() === String(awb).trim().toLowerCase()) ||
        (awb && o.dtdc_reference_number && o.dtdc_reference_number.trim().toLowerCase() === String(awb).trim().toLowerCase()) ||
        (customerReference && o.orderId.trim().toLowerCase() === String(customerReference).trim().toLowerCase())
    );

    let syncResult: any = { updated: false };

    if (order) {
      // Update specific DTDC tracking fields
      order.current_status = String(statusName || statusCode);
      order.current_status_code = String(statusCode);
      order.last_tracking_update = new Date().toISOString();
      await db.saveOrder(order);

      // Perform unified status sync (updates order.status, history, WhatsApp, NDR)
      const statusToSync = String(statusName || statusCode);
      const customRemarks = `DTDC Webhook: [Code: ${statusCode}] ${statusName}${location ? ` at ${location}` : ''}. ${remarks}`;
      syncResult = await syncOrderStatus(order.awb || String(awb), statusToSync, String(location), customRemarks);
    }

    // 3. Log diagnostic payload in courierLogs
    await db.addCourierLog({
      id: `cl-dtdc-webhook-${Date.now()}`,
      timestamp: new Date().toISOString(),
      courier: 'DTDC',
      action: 'Incoming Webhook Event',
      requestPayload: JSON.stringify(body, null, 2),
      responsePayload: JSON.stringify({
        success: true,
        eventRecorded: true,
        orderFound: !!order,
        orderId: order?.orderId || null,
        syncResult
      }, null, 2),
      status: 'Success'
    });

    return NextResponse.json({
      success: true,
      message: 'DTDC tracking webhook processed successfully.',
      orderId: order?.orderId || null,
      updated: syncResult.updated
    });

  } catch (error: any) {
    await db.addCourierLog({
      id: `cl-dtdc-webhook-err-${Date.now()}`,
      timestamp: new Date().toISOString(),
      courier: 'DTDC',
      action: 'Incoming Webhook Exception',
      requestPayload: 'Webhook processing exception',
      responsePayload: JSON.stringify({ error: error.message || error }, null, 2),
      status: 'Error'
    });

    return NextResponse.json({ error: error.message || 'DTDC Webhook processing failed.' }, { status: 500 });
  }
}
