---
type: "query"
date: "2026-11-04T19:41:19.419975+00:00"
question: "Implement 24-hour notification bell history, an all-history Activity Logs page limited to notification/order activity, two additional configurable dispatch numbers, and AWB contact-source visibility in OFD/NDR"
contributor: "graphify"
outcome: "useful"
source_nodes: ["src/app/dashboard/layout.tsx", "src/lib/db.ts", "src/app/dashboard/settings/page.tsx", "src/app/dashboard/packing/page.tsx", "src/app/dashboard/ofd/page.tsx", "src/app/dashboard/ndr/page.tsx", "src/app/dashboard/activity-logs/page.tsx"]
---

# Q: Implement 24-hour notification bell history, an all-history Activity Logs page limited to notification/order activity, two additional configurable dispatch numbers, and AWB contact-source visibility in OFD/NDR

## Answer

Query expanded to: notification, activity, logs, history, order, settings, phone, number, packing, ofd, ndr, stream. Implemented paginated notification/order activity aggregation and API/page; a rolling 24-hour bell drawer with full history link; Additional 1 and Additional 2 settings, order persistence, packing selection, and courier mapping; and stored/displayed AWB contact source in OFD/NDR. Preserved existing packing edits. Verified with 88 tests, lint, TypeScript, and a successful Next.js webpack production build.

## Outcome

- Signal: useful

## Source Nodes

- src/app/dashboard/layout.tsx
- src/lib/db.ts
- src/app/dashboard/settings/page.tsx
- src/app/dashboard/packing/page.tsx
- src/app/dashboard/ofd/page.tsx
- src/app/dashboard/ndr/page.tsx
- src/app/dashboard/activity-logs/page.tsx