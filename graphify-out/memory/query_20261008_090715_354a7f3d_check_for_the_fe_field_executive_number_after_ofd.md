---
type: "query"
date: "2026-10-08T09:07:15.249874+00:00"
question: "Check for the FE field executive number after OFD for all couriers and tell me whether the API responses contain it for later implementation."
contributor: "graphify"
outcome: "useful"
source_nodes: ["syncOrderStatus()", "courier/route.ts", "shadowfax/route.ts", "Order"]
---

# Q: Check for the FE field executive number after OFD for all couriers and tell me whether the API responses contain it for later implementation.

## Answer

Expanded from original query via graph vocab: [ofd, courier, tracking, track, status, number, phone, dtdc, delhivery, xpressbees]. Findings: Shadowfax definitely supports FE data. Actual stored track responses contain data.rider_name and data.rider_contact, currently null because sampled shipments are status new; official Shadowfax forward callback documentation lists rider_name and rider_contact as available placeholders for Assigned for Customer Delivery / Out For Delivery. The dedicated /api/webhooks/shadowfax route already reads rider_contact/riderPhone and saves order.feNumber, but the polling track route and the alternate integration webhook do not preserve rider fields. Delhivery: seven stored successful real tracking responses containing OFD scans were inspected; none included an FE/rider phone. Only Consignee.Telephone1/Telephone2 appeared and were empty, so these are not FE fields. XpressBees: unconfirmed because all stored HTTP-success tracking payloads actually contain ReturnCode 101 Invalid token key and CurrentShipmentStatus null; there is no real OFD payload. Its normalizer only keeps status/location/date/remarks, so any dedicated rider field would currently be discarded; a 10-digit number inside remarks could be captured. DTDC: unconfirmed because all 302 stored tracking attempts are errors/401 and no successful live OFD response exists. Its parser keeps activity/status/remarks/instructions only. Across stored orders, feNumber is populated for zero DTDC, XpressBees, Delhivery, or Shadowfax orders. Generic syncOrderStatus extracts the first Indian 10-digit number from OFD status/remarks, but explicit field mapping is safer to avoid capturing a customer number.

## Outcome

- Signal: useful

## Source Nodes

- syncOrderStatus()
- courier/route.ts
- shadowfax/route.ts
- Order