---
type: "query"
date: "2026-10-05T13:44:05.417199+00:00"
question: "I have a question, i want to ask if i make a order with the diff number and whn creating awb i chose a diff number thn what number will go in the payload?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Order", "[id]/route.ts", "bookCourierShipment()", "courierQueue.ts", "triggerWhatsAppNotification()"]
---

# Q: I have a question, i want to ask if i make a order with the diff number and whn creating awb i chose a diff number thn what number will go in the payload?

## Answer

Expanded from graph vocabulary: [awb, courier, order, phone, shipment]. The phone explicitly selected in the AWB generation screen is resolved from the order contact fields and sent as the courier consignee/customer phone. It is also stored as shipmentContactPhone and shipmentContactType for audit. The original order phone fields are not overwritten. Customer WhatsApp notifications are independent and always go only to the mandatory phoneWhatsApp number. If no AWB phone choice is supplied through a legacy/default call, phonePrimary is used.

## Outcome

- Signal: useful

## Source Nodes

- Order
- [id]/route.ts
- bookCourierShipment()
- courierQueue.ts
- triggerWhatsAppNotification()