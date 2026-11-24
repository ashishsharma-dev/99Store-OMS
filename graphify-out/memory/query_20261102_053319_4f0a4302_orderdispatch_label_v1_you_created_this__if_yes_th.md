---
type: "query"
date: "2026-11-02T05:33:19.462393+00:00"
question: "orderdispatch_label_v1 you created this? if yes thn i want to tell you this is working do for all templates which are used after label generation"
contributor: "graphify"
outcome: "useful"
source_nodes: ["triggerWhatsAppNotification()", "whatsapp.ts", "WalabzClient", "Order", "syncOrderStatus()"]
---

# Q: orderdispatch_label_v1 you created this? if yes thn i want to tell you this is working do for all templates which are used after label generation

## Answer

Expanded from original query via graph vocab: [whatsapp, walabz, template, templates, label, dispatch, notification, trigger, campaign, status, order]. The graph traced post-label sending through triggerWhatsAppNotification(), whatsapp.ts, WalabzClient, Order, and syncOrderStatus(). Live inspection showed configured post-label mappings for Dispatched, RDC, OFD, Delivered, and NDR. Image-header versions were approved and activated for RDC, OFD, Delivered, and NDR; Dispatched already used orderdispatch_label_v1.

## Outcome

- Signal: useful

## Source Nodes

- triggerWhatsAppNotification()
- whatsapp.ts
- WalabzClient
- Order
- syncOrderStatus()