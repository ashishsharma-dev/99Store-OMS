---
type: "query"
date: "2026-09-29T15:38:26.374602+00:00"
question: "When creating an order and then generating the AWB, does the selected phone number and courier reach the courier request payload?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Order", "packing/page.tsx", "[id]/route.ts", "bookCourierShipment()", "courierQueue.ts", "shadowfax.ts", "velocity.ts"]
---

# Q: When creating an order and then generating the AWB, does the selected phone number and courier reach the courier request payload?

## Answer

Expanded from graph vocabulary: [order, awb, number, phone, courier, shipment, dtdc, xpressbees, shadowfax, velocity, address]. Diagnosis: the selected phone flow is broken. The packing UI stores the row selection, but opening the single-AWB modal resets the choice to Primary. The modal sends its resolved number as phonePrimary in the PATCH request, but the PATCH route does not destructure or apply phonePrimary and instead calls bookCourierShipment with the existing order.phonePrimary. Therefore secondary, tertiary, and custom choices cannot reach the courier in the single flow. Bulk jobs correctly derive a selectedPhone and pass it to bookCourierShipment. XpressBees, DTDC, and Delhivery consume phoneOverride, but Shadowfax and Velocity ignore it and use order.phonePrimary. Persisted Shadowfax logs on 2026-09-23 confirm recent orders whose history records a custom/other selected number still sent Primary in the actual request payload. Courier choice itself is passed correctly; Velocity/Aggregator intentionally leaves carrier_id blank, so Velocity may assign a downstream courier on the manifest.

## Outcome

- Signal: useful

## Source Nodes

- Order
- packing/page.tsx
- [id]/route.ts
- bookCourierShipment()
- courierQueue.ts
- shadowfax.ts
- velocity.ts