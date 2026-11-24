---
type: "query"
date: "2026-10-08T05:32:23.413928+00:00"
question: "Check orders 99S-1156 and 99S-1157: they show Pickup scheduled and the same information on previous dates; how is that possible?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Order", "Tracking()", "syncOrderStatus()", "orders/route.ts", "courier/route.ts"]
---

# Q: Check orders 99S-1156 and 99S-1157: they show Pickup scheduled and the same information on previous dates; how is that possible?

## Answer

Expanded from original query via graph vocab: [order, orders, tracking, track, status, history, event, date, courier, shipment, shipments, sync]. Diagnosis from local records plus read-only live carrier checks: 99S-1156 is Delhivery AWB 1635310050621. Delhivery live tracking shows Manifested/Pickup scheduled on 2026-09-30, Out for Pickup then Shipment not ready followed by Pickup scheduled on 2026-10-01, the same pattern on 2026-10-02, and current status Not Picked / Shipment not received from client on 2026-10-05. These are repeated pickup attempts for one parcel; it was never physically picked up. The OMS still says Dispatched because Manifested maps to Dispatched, while Not Picked is not mapped and therefore cannot replace the old internal status. For current 99S-1157, the local order is DTDC AWB 7X123299015 created 2026-09-30 and its own history contains no Pickup scheduled event. But courier logs prove an older Delhivery shipment AWB 1635310041650 used ReferenceNo 99S-1157 on 2026-08-10 and had Pickup scheduled twice. The order number was reused after prior order rows were removed/restored because new IDs are computed as max(current orders)+1 rather than from a permanent sequence/historical uniqueness constraint. Searching by reference/order number can therefore show the old Delhivery history for the new DTDC order. DTDC live verification currently returns HTTP 401 due tracking authentication, so its current courier state was not confirmed.

## Outcome

- Signal: useful

## Source Nodes

- Order
- Tracking()
- syncOrderStatus()
- orders/route.ts
- courier/route.ts