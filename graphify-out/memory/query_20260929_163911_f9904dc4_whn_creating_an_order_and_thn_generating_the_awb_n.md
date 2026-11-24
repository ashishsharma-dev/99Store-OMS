---
type: "query"
date: "2026-09-29T16:39:11.601975+00:00"
question: "Whn creating an order and thn generating the AWB Number and selecting the number and courier to send in the request payloads this flow should be working because currently selecting a number is not working i think the courier is generating the manifests with the another numbers check once and let me know."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Order", "Packing()", "bookCourierShipment()", "courierQueue.ts", "shadowfax.ts", "velocity.ts", "DTDC AWB & Shipping Label Generation", "Multi-Courier Routing Engine"]
---

# Q: Whn creating an order and thn generating the AWB Number and selecting the number and courier to send in the request payloads this flow should be working because currently selecting a number is not working i think the courier is generating the manifests with the another numbers check once and let me know.

## Answer

Expanded from original query via vocab: [order, awb, phone, courier, customer, packing, bulk, routing, shipment, dtdc, xpressbees, shadowfax]. Review confirmed two single-AWB phone defects: the modal resets selection to Primary and the PATCH handler ignores phonePrimary then calls bookCourierShipment with order.phonePrimary. Bulk resolves the binding, but Shadowfax and Velocity adapters ignore the override. Courier selection itself is preserved except Velocity Aggregator deliberately leaves carrier_id blank for downstream auto-assignment. Existing logs corroborate Shadowfax manifests using Primary after another contact was selected. Recommended explicit shipmentContactPhone contract, provider-wide propagation, persistence/audit, validation, idempotency, and adapter tests.

## Outcome

- Signal: useful

## Source Nodes

- Order
- Packing()
- bookCourierShipment()
- courierQueue.ts
- shadowfax.ts
- velocity.ts
- DTDC AWB & Shipping Label Generation
- Multi-Courier Routing Engine