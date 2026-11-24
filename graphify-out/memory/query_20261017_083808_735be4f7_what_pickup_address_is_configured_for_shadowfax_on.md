---
type: "query"
date: "2026-10-17T08:38:08.911570+00:00"
question: "What pickup address is configured for Shadowfax on live OMS?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["shadowfax.ts", "bookShadowfaxOrder"]
---

# Q: What pickup address is configured for Shadowfax on live OMS?

## Answer

Live MongoDB system-settings shadowfaxConfig uses warehouse WH_SFX_01, contact Vishnu Singh Sikarwar, phone 8057023592, address J.K. NAGAR, NANDLALPUR HATHRAS ROAD KUBERPUR, address2 Kuberpur, Agra, Uttar Pradesh 282006, order type warehouse, production base URL https://dale.shadowfax.in/api. bookShadowfaxOrder sends this same address for pickup, RTO and RTS. If Shadowfax rejects pickup pincode as unserviceable, current code retries using pincode 110060 while retaining non-empty configured Agra city/state/address fields.

## Outcome

- Signal: useful

## Source Nodes

- shadowfax.ts
- bookShadowfaxOrder