<!-- converted from DTDC_Integration_Specification_AI_Agent.docx -->

# DTDC Integration Specification (AI Agent Summary)
Goal:
Implement Order Booking, Shipping Label, Tracking Webhook, and Cancellation APIs.
## Authentication
- Header: Content-Type: application/json
- api-key: YOUR_DTDC_API_KEY
- Production: https://pxapi.dtdc.in
- Staging: https://alphademodashboardapi.shipsy.io
## Order Booking
- POST /api/customer/integration/consignment/softdata
- Create shipment, save reference_number/AWB, customer_reference_number, shipment status.
## Shipping Label
- GET /api/customer/integration/consignment/shippinglabel/stream
- Params: reference_number, label_code, label_format(pdf/base64).
- Store PDF/Base64 and allow download.
## Tracking Webhook
- Create POST /api/webhooks/dtdc/tracking
- Store every tracking event, update current order status, maintain timeline.
## Cancellation
- POST /api/customer/integration/consignment/cancel
- Body: AWBNo[], customerCode.
- Mark shipment cancelled on success.
## Database
- orders: dtdc_reference_number,current_status,current_status_code,last_tracking_update,label_generated,cancelled
- tracking_events: shipment,status_code,status_name,location,remarks,date,time,lat,lng
## Workflow
- Order -> Book Shipment -> Save AWB -> Generate Label -> DTDC Push Tracking -> Update Status -> Customer Tracking -> Optional Cancel
## Admin
- Book Shipment, Generate Label, Download Label, Cancel Shipment, Tracking Timeline
## Customer
- Show Current Status, EDD, Timeline, Latest Location, Non-delivery Reason
## Errors
- Handle 400,401, network failures, retries, duplicate shipment, validation errors.