---
type: "query"
date: "2026-09-29T17:20:13.481179+00:00"
question: "Now what is the plan to move forward and make this application production ready?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Order", "bookCourierShipment()", "auth.ts", "users/route.ts", "SystemSettings", "db", "mongodb", "courier/webhook/route.ts", "Packing()", "triggerWhatsAppNotification()"]
---

# Q: Now what is the plan to move forward and make this application production ready?

## Answer

Expanded from original query via vocab: [order, courier, auth, settings, webhook, database, mongodb, whatsapp, packing, shipment, tracking, security]. Production-readiness plan: Phase 0 protect data and rotate exposed secrets; Phase 1 fix shipment contact selection with an explicit shipmentContactPhone contract across single, bulk, DTDC, XpressBees, Delhivery, Shadowfax and Velocity; Phase 2 add server-side sessions/RBAC, remove OTP bypass, redact APIs and authenticate webhooks; Phase 3 make MongoDB the authoritative store with indexes, atomic IDs, awaited writes, idempotent courier booking and reliable background jobs; Phase 4 fail closed on courier errors, remove production mock AWBs, standardize adapters and add structured observability; Phase 5 add integration/E2E tests, repair lint and documentation; Phase 6 run staging/UAT, backup/restore and rollback drills, then controlled cutover. Go-live gates include zero fake AWBs, protected APIs, rotated secrets, verified payloads for every courier, passing build/lint/tests and successful restore rehearsal.

## Outcome

- Signal: useful

## Source Nodes

- Order
- bookCourierShipment()
- auth.ts
- users/route.ts
- SystemSettings
- db
- mongodb
- courier/webhook/route.ts
- Packing()
- triggerWhatsAppNotification()