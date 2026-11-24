---
type: "query"
date: "2026-11-02T05:53:55.286264+00:00"
question: "The Real-Time Stream Feed is not still not showing real time notifications fix this."
contributor: "graphify"
outcome: "useful"
source_nodes: ["stream/route.ts", "dashboard/layout.tsx", "db.ts", "Order", "Tracking()"]
---

# Q: The Real-Time Stream Feed is not still not showing real time notifications fix this.

## Answer

Expanded from original query via graph vocab: [notification, stream, event, dashboard, message, messages, order, orders, tracking]. The graph traced the feed through stream/route.ts, dashboard/layout.tsx, db.ts, Order, and tracking paths. Production diagnosis showed Nginx buffered the SSE stream and the route only inspected five naturally ordered records. Commit 3014492 adds X-Accel-Buffering no plus no-transform caching, queries the 50 most recently updated orders from MongoDB, prevents overlapping polls, and adds regression tests. Production verification returned the first authenticated SSE event in 72 ms.

## Outcome

- Signal: useful

## Source Nodes

- stream/route.ts
- dashboard/layout.tsx
- db.ts
- Order
- Tracking()