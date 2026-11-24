---
type: "query"
date: "2026-09-29T15:30:42.463735+00:00"
question: "understand this project using graphify skill"
contributor: "graphify"
outcome: "useful"
source_nodes: ["99Store OMS Architecture", "Order", "db", "courier/route.ts", "courier/webhook/route.ts", "triggerWhatsAppNotification()", "auth.ts", "startCourierQueueProcessor()"]
---

# Q: understand this project using graphify skill

## Answer

Expanded from original query via graph vocab: [architecture, order, shipment, courier, api, webhook, database, auth, dashboard, payment, return, service]. 99Store OMS V2 is a Next.js order-management system centered on the Order domain model and a shared MongoDB-backed db abstraction. Dashboard pages drive order, packing, shipment, tracking, OFD, and NDR workflows. Route handlers provide order, user, reporting, messaging, pincode/serviceability, and courier endpoints. Courier orchestration integrates XpressBees, Shadowfax, Velocity, DTDC, and Delhivery-related specifications; booking, tracking, cancellation, retries, synchronization, webhooks, and a background bulk queue converge on order status updates. Status changes and order operations invoke triggerWhatsAppNotification(), which delegates to Walabz and can generate packing-slip images. Authentication includes password hashing and OTP generation, while the documented security model also includes IP whitelisting. The most connected abstractions are next, db, Order, triggerWhatsAppNotification(), WalabzClient, getXpressBeesToken(), and bookCourierShipment(). Main risks visible in the graph are low cohesion in NDR/state and messaging communities, 109 isolated nodes, and two inferred WhatsApp call edges that need verification.

## Outcome

- Signal: useful

## Source Nodes

- 99Store OMS Architecture
- Order
- db
- courier/route.ts
- courier/webhook/route.ts
- triggerWhatsAppNotification()
- auth.ts
- startCourierQueueProcessor()