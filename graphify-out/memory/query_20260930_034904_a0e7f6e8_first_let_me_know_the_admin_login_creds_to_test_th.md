---
type: "query"
date: "2026-09-30T03:49:04.022751+00:00"
question: "First let me know the admin login creds to test this application and next break it down to the doable steps to move forward next"
contributor: "graphify"
outcome: "useful"
source_nodes: ["auth.ts", "send-otp/route.ts", "User", "mongodb", "courierQueue.ts", "courier/route.ts", "Order", "test", "lint", "deploy.sh"]
---

# Q: First let me know the admin login creds to test this application and next break it down to the doable steps to move forward next

## Answer

Expanded through graph vocabulary: [auth, security, database, mongodb, queue, courier, order, test, lint, deploy, health, backup]. Verified the active seeded Super Admin account uses username admin and seed password admin123. Local OTP bypass is disabled and IP whitelist is disabled; the real OTP goes to the configured WhatsApp target. Recommended sequence: manual login and AWB smoke test, checkpoint and documentation, password and secret hardening, MongoDB fail-closed persistence and indexes, durable queue and shared rate limiting, full courier acceptance tests, lint/build cleanup and CI, staging deployment, credential rotation, and production launch.

## Outcome

- Signal: useful

## Source Nodes

- auth.ts
- send-otp/route.ts
- User
- mongodb
- courierQueue.ts
- courier/route.ts
- Order
- test
- lint
- deploy.sh