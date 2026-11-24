---
type: "query"
date: "2026-11-02T06:18:28.474126+00:00"
question: "Find to way to get the number of the delivery boy after OFD"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Order", "ofd/page.tsx", "shadowfax.ts", "courierSync.ts", "courier/route.ts", "xpressbees.ts"]
---

# Q: Find to way to get the number of the delivery boy after OFD

## Answer

Expanded from original query via graph vocab: [ofd, courier, tracking, delivery, phone, shipment, status, dtdc, delhivery, shadowfax, xpressbees, number]. The app already stores feNumber and displays it in OFD, but the active public Shadowfax callback ignored rider_contact while a duplicate route saved it. Official Shadowfax OFD callbacks provide rider_name and rider_contact. Added a safe structured delivery-agent extractor, wired both Shadowfax callback routes and tracking normalization to preserve FE numbers, including masked virtual numbers and account-specific XpressBees fields, without scanning consignee or recipient numbers. Standard DTDC, Delhivery, and documented XpressBees tracking responses do not guarantee a rider phone, so those require an account-enabled field or carrier POC.

## Outcome

- Signal: useful

## Source Nodes

- Order
- ofd/page.tsx
- shadowfax.ts
- courierSync.ts
- courier/route.ts
- xpressbees.ts