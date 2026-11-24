---
type: "query"
date: "2026-11-02T06:01:19.391392+00:00"
question: "Check one thing, parcels that are currently OFD check for the Field Executive or the Delivery Boy number if api allows for it and let me know the results"
contributor: "graphify"
outcome: "useful"
source_nodes: ["courier/route.ts", "Tracking()", "Order", "ofd/page.tsx", "shadowfax.ts"]
---

# Q: Check one thing, parcels that are currently OFD check for the Field Executive or the Delivery Boy number if api allows for it and let me know the results

## Answer

Expanded from original query via graph vocab: [ofd, courier, tracking, delivery, phone, contact, shipment, order, status, dtdc, delhivery, shadowfax]. The graph traced courier tracking through courier/route.ts, courierTrackingHandler.ts, dtdcTracking.ts, shadowfax.ts, and OFD management. A read-only live check on 2026-11-02 found five OFD orders: three DTDC and two Delhivery. All five tracking APIs returned HTTP 200, but no field-executive, rider, delivery-agent, delivery-boy, phone, mobile, contact, or keyword-associated phone fields were present after excluding customer phone data. There were no current XpressBees or Shadowfax OFD parcels, so their FE fields could not be validated against a live OFD response.

## Outcome

- Signal: useful

## Source Nodes

- courier/route.ts
- Tracking()
- Order
- ofd/page.tsx
- shadowfax.ts