---
type: "query"
date: "2026-09-29T17:24:46.872033+00:00"
question: "Make a plan to do these changes in steps i want you to make this app production ready and for the creds rotation i will do this after these changes lets proceed further"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Order", "Packing()", "bookCourierShipment()", "auth.ts", "users/route.ts", "SystemSettings", "courier/webhook/route.ts", "db", "mongodb", "test"]
---

# Q: Make a plan to do these changes in steps i want you to make this app production ready and for the creds rotation i will do this after these changes lets proceed further

## Answer

Expanded from original query via vocab: [order, courier, packing, shipment, auth, security, settings, webhook, database, mongodb, test, report]. Agreed execution plan: 0 baseline and backup; 1 fix four-number AWB selection and provider propagation with tests; 2 replace client-only auth with server sessions and RBAC; 3 prepare environment-based secret management and redact APIs without rotating credentials yet; 4 make courier booking fail closed, idempotent, authenticated at webhooks and observable; 5 consolidate MongoDB as production source of truth with indexes and atomic IDs; 6 repair tests, lint, CI and documentation; 7 deploy staging and complete UAT; 8 user rotates credentials, then controlled production rollout. Each phase has a release gate and credentials remain unrotated only until the final pre-production gate.

## Outcome

- Signal: useful

## Source Nodes

- Order
- Packing()
- bookCourierShipment()
- auth.ts
- users/route.ts
- SystemSettings
- courier/webhook/route.ts
- db
- mongodb
- test