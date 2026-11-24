---
type: "query"
date: "2026-11-05T09:33:21.213318+00:00"
question: "First make some read only checks and find out why this error comes and how to fix it"
contributor: "graphify"
outcome: "useful"
source_nodes: ["bookCourierShipment()", "courierQueue.ts", "serviceability/route.ts", "orders/route.ts", "courierHelper.ts"]
---

# Q: First make some read only checks and find out why this error comes and how to fix it

## Answer

Expanded from graph vocabulary: [dtdc, courier, shipment, service, serviceability, pincode, customer, config, tracking, route, code, shipments]. Read-only live checks found healthy DTDC credentials and tracking, but booking failures split into account AWB-series exhaustion and destination eligibility. 78 NO_SERIES_AVAILABLE errors require DTDC to replenish/map a B2C PRIORITY AWB series for the active customer account. Other failures are correctly explained by DTDC live pincode flags: special destination, B2C COD disabled, invalid/unserviceable pincode. The app currently uses a false static DTDC rule of pincode prefix not equal to 7 and bulk booking does not reroute. Fix by integrating the DTDC pincode response, checking payment-specific flags, adding per-order fallback routing, and circuit-breaking NO_SERIES_AVAILABLE.

## Outcome

- Signal: useful

## Source Nodes

- bookCourierShipment()
- courierQueue.ts
- serviceability/route.ts
- orders/route.ts
- courierHelper.ts