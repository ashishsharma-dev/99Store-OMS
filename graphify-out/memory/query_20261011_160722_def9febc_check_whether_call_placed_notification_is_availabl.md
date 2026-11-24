---
type: "query"
date: "2026-10-11T16:07:22.653427+00:00"
question: "Check whether call placed notification is available from courier APIs and implement it for the specific order"
contributor: "graphify"
outcome: "useful"
source_nodes: ["syncOrderStatus()", "courier/route.ts", "Order", "courier/webhook/route.ts"]
---

# Q: Check whether call placed notification is available from courier APIs and implement it for the specific order

## Answer

Confirmed Delhivery tracking responses include Instructions Call placed to consignee with status code ST-114. The integration previously ignored it because it read the oldest Scans[0] entry and only mapped top-level status. Implemented latest-scan selection plus call-placed instruction mapping; order lookup remains AWB-specific.

## Outcome

- Signal: useful

## Source Nodes

- syncOrderStatus()
- courier/route.ts
- Order
- courier/webhook/route.ts