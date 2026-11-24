---
type: "query"
date: "2026-10-21T12:42:51.800260+00:00"
question: "Fix live Shadowfax pickup booking rejection and verify/fix DTDC booking"
contributor: "graphify"
outcome: "useful"
source_nodes: ["shadowfax.ts", "checkShadowfaxServiceability", "checkShadowfaxPickupServiceability", "bookShadowfaxOrder"]
---

# Q: Fix live Shadowfax pickup booking rejection and verify/fix DTDC booking

## Answer

Live diagnosis on 2026-10-21 found Shadowfax account pincode 282006 had Marketplace and RTS tiers for seller_pickup/seller_delivery but no dc_pickup tier for warehouse_pickup. Switched live shadowfaxConfig.orderType from warehouse to marketplace. Restored protected DTDC_API_KEY, DTDC_CUSTOMER_CODE, username/password/access token from local .env.local to live .env.local. DTDC production softdata endpoint now authenticates with HTTP 200 status OK instead of 401 NO_API_KEY. Added checkShadowfaxOrderServiceability to validate customer delivery plus pickup and return legs with correct tiers for Marketplace/Warehouse and Regular/Surface. Deployed commit a15ad5c; 56 tests, lint, production build, PM2 and public/local health passed. Order 99S-1006 is already booked and dispatched via XpressBees AWB 153999420048210.

## Outcome

- Signal: useful

## Source Nodes

- shadowfax.ts
- checkShadowfaxServiceability
- checkShadowfaxPickupServiceability
- bookShadowfaxOrder