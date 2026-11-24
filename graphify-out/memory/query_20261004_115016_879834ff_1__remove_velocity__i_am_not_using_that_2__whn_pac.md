---
type: "query"
date: "2026-10-04T11:50:16.115924+00:00"
question: "1. Remove Velocity, i am not using that 2. Whn package is scanned from the bar code scanner and the status of the parcel is changed to scanned thn it should marked as dispatched automatically and dispatch message notification should be delivered to the customer's whatsapp number. 3. All the message notifications shoud be delivered to the customer's whatsapp number only and make the whatsapp number mandatory at the time of order entry. Also use your intelligence and let me know these changes are good or we need to alter something..."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Packing()", "triggerWhatsAppNotification()", "Order", "courier/route.ts", "orders/route.ts"]
---

# Q: 1. Remove Velocity, i am not using that 2. Whn package is scanned from the bar code scanner and the status of the parcel is changed to scanned thn it should marked as dispatched automatically and dispatch message notification should be delivered to the customer's whatsapp number. 3. All the message notifications shoud be delivered to the customer's whatsapp number only and make the whatsapp number mandatory at the time of order entry. Also use your intelligence and let me know these changes are good or we need to alter something...

## Answer

Expanded from graph vocabulary: [velocity, barcode, packing, package, order, courier, whatsapp, notification, customer, phone]. Implemented removal of Velocity and its Aggregator alias from active source, settings, routing, UI, credentials template, migration tooling, and tests while preserving historical database records. Added an authenticated barcode dispatch endpoint and packing-page scanner input that accept order ID or AWB, require Label Generated status, AWB, and a valid customer WhatsApp number, transition once to Dispatched, and avoid re-sending an already successful dispatch notification. Restricted all customer order notifications to phoneWhatsApp, made that field mandatory and validated on create/edit, and prevented duplicate status notifications. Production build, blocking lint, and 29 tests pass. Recommendation: direct Scan-to-Dispatched is better than a transient Scanned status; show notification failures and allow idempotent retry. Existing historical orders without phoneWhatsApp must be backfilled before they can be dispatched.

## Outcome

- Signal: useful

## Source Nodes

- Packing()
- triggerWhatsAppNotification()
- Order
- courier/route.ts
- orders/route.ts