---
type: "query"
date: "2026-10-11T16:12:33.550894+00:00"
question: "Let me know the field executive number and the call placed notification details for all the couriers."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Order", "courier/route.ts", "syncOrderStatus()", "shadowfax/webhook/route.ts", "tracking/route.ts"]
---

# Q: Let me know the field executive number and the call placed notification details for all the couriers.

## Answer

Expanded from original query via vocab: [courier, tracking, status, notification, phone, order, webhook, delhivery, dtdc, shadowfax, xpressbees, velocity]. Current database has zero stored FE numbers for DTDC, Delhivery, XpressBees, and Shadowfax. Delhivery alone has a confirmed call event: order 99S-1050, AWB 1635310035910, Instructions Call placed to consignee, code ST-114, scan Dispatched, event time 2026-08-06T12:58:39.002, Faridabad_Sector53_D; no FE number. DTDC responses are all 401 unauthorized, XpressBees payloads report invalid token, and neither yields FE or call data. Shadowfax payload schema exposes rider_name and rider_contact, but current samples contain null and no call event; its webhook persists rider_contact to feNumber. Velocity is inactive and has no tracking logs.

## Outcome

- Signal: useful

## Source Nodes

- Order
- courier/route.ts
- syncOrderStatus()
- shadowfax/webhook/route.ts
- tracking/route.ts