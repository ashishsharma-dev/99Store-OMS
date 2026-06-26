import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncOrderStatus } from '@/lib/courierSync';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Extract Tracking Number (AWB)
    const awb = 
      body.waybill || 
      body.awb || 
      body.awb_number || 
      body.shipment_id || 
      body.ShipmentData?.[0]?.Shipment?.AWB;

    if (!awb) {
      return NextResponse.json({ error: 'Missing waybill/awb identification in payload.' }, { status: 400 });
    }

    // 2. Extract Courier Status
    const status = 
      body.status || 
      body.current_status || 
      body.status_name || 
      body.status_code || 
      body.ShipmentData?.[0]?.Shipment?.Status?.Status;

    if (!status) {
      return NextResponse.json({ error: 'Missing courier status description in payload.' }, { status: 400 });
    }

    // 3. Extract metadata (location & remarks)
    const location = 
      body.location || 
      body.scanned_location || 
      body.activity_office || 
      body.ShipmentData?.[0]?.Shipment?.Status?.StatusLocation || 
      '';

    const remarks = 
      body.remarks || 
      body.instructions || 
      body.status_description || 
      body.remarks_desc || 
      '';

    // 4. Detect Courier Brand
    let courier: string = 'Unknown';
    if (body.courier) {
      courier = body.courier;
    } else {
      const order = (await db.getOrders()).find(o => o.awb && o.awb.trim().toLowerCase() === String(awb).trim().toLowerCase());
      if (order && order.courier) {
        courier = order.courier;
      } else if (String(awb).startsWith('XB') || String(awb).startsWith('5963')) {
        courier = 'XpressBees';
      } else {
        courier = 'Delhivery'; // Default fallback
      }
    }

    const customRemarks = `Webhook received from ${courier}. Status: "${status}"${location ? ` at ${location}` : ''}. ${remarks}`;

    // 5. Run Sync Update
    const result = await syncOrderStatus(String(awb), String(status), String(location), customRemarks);

    // 6. Log Webhook Payload in system database for settings diagnostic terminal
    await db.addCourierLog({
      id: `cl-webhook-${Date.now()}`,
      timestamp: new Date().toISOString(),
      courier,
      action: 'Incoming Webhook Status Update',
      requestPayload: JSON.stringify(body, null, 2),
      responsePayload: JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        statusUpdated: result.updated,
        newStatus: result.order?.status || 'Unchanged',
        details: result.error || null
      }, null, 2),
      status: 'Success'
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed successfully', 
      statusUpdated: result.updated 
    });

  } catch (error: any) {
    // Log Webhook Errors too
    await db.addCourierLog({
      id: `cl-webhook-err-${Date.now()}`,
      timestamp: new Date().toISOString(),
      courier: 'System',
      action: 'Incoming Webhook Exception',
      requestPayload: 'Failed to read payload text',
      responsePayload: JSON.stringify({ error: error.message || 'Webhook parsing failure' }, null, 2),
      status: 'Error'
    });

    return NextResponse.json({ error: error.message || 'Webhook execution failed.' }, { status: 500 });
  }
}
