---
type: "query"
date: "2026-10-11T17:34:33.068216+00:00"
question: "tell me the current order creation model of shadowfax?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Order", "bookShadowfaxOrder()", "bookCourierShipment()", "courierQueue.ts", "orders/route.ts", "shadowfax.ts"]
---

# Q: tell me the current order creation model of shadowfax?

## Answer

Expanded from original query via vocab: [shadowfax, order, book, courier, customer, shipment, awb]. Current Shadowfax creation is a two-stage warehouse fulfillment model. OMS first creates a local order with status Created and optionally assigns Shadowfax by priority. Courier booking occurs when status moves to Label Generated or via bulk queue. It POSTs Token-authenticated JSON to /v3/clients/orders/ with order_type warehouse, order_details, customer_details, pickup_details, product_details, and identical pickup-derived rto_details/rts_details. Current settings use production dale.shadowfax.in, warehouse code WH_SFX_01, Agra UP 282006. Success requires message Success and data.awb_number; already-created responses recover the existing AWB. Reliability layer prevents simultaneous booking and duplicate AWB assignment. Pickup-pincode failure retries using authorized hub pincode 110060 production or 110001 staging.

## Outcome

- Signal: useful

## Source Nodes

- Order
- bookShadowfaxOrder()
- bookCourierShipment()
- courierQueue.ts
- orders/route.ts
- shadowfax.ts