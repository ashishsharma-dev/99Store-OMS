---
type: "explain"
date: "2026-11-04T18:42:05.968924+00:00"
question: "What request payload does the app send when generating a new DTDC order?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["src/lib/courierHelper.ts", "src/lib/dtdcBooking.ts", "tests/dtdcBooking.test.ts"]
---

# Q: What request payload does the app send when generating a new DTDC order?

## Answer

The app POSTs JSON with a consignments array to DTDC softdata. Each consignment contains account/service IDs, fixed parcel dimensions, weight/value, origin and destination details, an immutable OMS hash reference, commodity/description, blank reference_number, and COD fields only when collectible COD is positive. Authentication uses the api-key header.

## Outcome

- Signal: useful

## Source Nodes

- src/lib/courierHelper.ts
- src/lib/dtdcBooking.ts
- tests/dtdcBooking.test.ts