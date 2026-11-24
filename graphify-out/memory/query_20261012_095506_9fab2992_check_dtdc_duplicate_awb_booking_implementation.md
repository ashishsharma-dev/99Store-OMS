---
type: "query"
date: "2026-10-12T09:55:06.207220+00:00"
question: "Check DTDC duplicate AWB booking implementation"
contributor: "graphify"
outcome: "useful"
source_nodes: ["bookCourierShipment()", "Order"]
---

# Q: Check DTDC duplicate AWB booking implementation

## Answer

Expanded via graph vocabulary: dtdc book courier order duplicate awb retry. Graph located bookCourierShipment in src/lib/courierHelper.ts and Order in types.ts. Source inspection confirmed DTDC used reusable display orderId as customer_reference_number. Fix uses immutable order identity plus creation timestamp hashed into a retry-stable DTDC-only reference; response mismatches require reconciliation. Existing shipments are untouched.

## Outcome

- Signal: useful

## Source Nodes

- bookCourierShipment()
- Order