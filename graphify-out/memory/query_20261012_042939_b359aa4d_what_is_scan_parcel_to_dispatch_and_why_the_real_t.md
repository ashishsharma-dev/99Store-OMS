---
type: "query"
date: "2026-10-12T04:29:39.483638+00:00"
question: "What is Scan parcel to dispatch and why the Real-Time API Scans are showing DTDC Tracking Request failed: HTTP 401 Error this error make a fix for these errors..."
contributor: "graphify"
outcome: "useful"
source_nodes: ["courier/route.ts", "Tracking()", "Packing()"]
---

# Q: What is Scan parcel to dispatch and why the Real-Time API Scans are showing DTDC Tracking Request failed: HTTP 401 Error this error make a fix for these errors...

## Answer

Expanded from original query via graph vocab: [dtdc, tracking, track, auth, token, courier, integration, shipment, authenticated]. Scan parcel to dispatch is the packing workflow that matches an order barcode or AWB, requires a generated AWB, Label Generated status, and a valid customer WhatsApp number, then marks the order Dispatched and sends the notification. The DTDC 401 was caused by always trusting a configured DTDC_ACCESS_TOKEN even after it expired. Added dtdcTracking.ts to authenticate when needed, cache fresh tokens, refresh once after 401 or 403, retry tracking, parse token response formats safely, and return actionable credential errors. Updated courier/route.ts and added passing tests.

## Outcome

- Signal: useful

## Source Nodes

- courier/route.ts
- Tracking()
- Packing()