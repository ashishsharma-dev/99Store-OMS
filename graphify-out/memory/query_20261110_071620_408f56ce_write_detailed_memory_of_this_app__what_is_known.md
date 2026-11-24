---
type: "query"
date: "2026-11-10T07:16:20.721401+00:00"
question: "Write detailed memory of this app, what is known, and what anyone needs to know before making changes"
contributor: "graphify"
outcome: "useful"
source_nodes: ["db.ts", "courierHelper.ts", "courierQueue.ts", "trackingScheduler.ts", "whatsappReconciliation.ts", "vps-release.py"]
---

# Q: Write detailed memory of this app, what is known, and what anyone needs to know before making changes

## Answer

Created docs/APP_MEMORY.md as a secret-free operational handover. It documents the Next.js/MongoDB/PM2 architecture, domain model, roles/auth, settings and shipment-contact invariants, courier behavior and DTDC incident findings, WhatsApp reconciliation, activity logs, performance requirements, local verification, safe deployment/rollback, backups, tests, known risks, and change checklist. Expanded from project vocabulary: [dtdc, courier, shipment, service, serviceability, pincode, customer, config, tracking, route, code, shipments].

## Outcome

- Signal: useful

## Source Nodes

- db.ts
- courierHelper.ts
- courierQueue.ts
- trackingScheduler.ts
- whatsappReconciliation.ts
- vps-release.py