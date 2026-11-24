---
type: "query"
date: "2026-10-17T08:44:05.294852+00:00"
question: "Fix Shadowfax fallback that mixed Agra address with Delhi pincode 110060"
contributor: "graphify"
outcome: "useful"
source_nodes: ["shadowfax.ts", "bookShadowfaxOrder"]
---

# Q: Fix Shadowfax fallback that mixed Agra address with Delhi pincode 110060

## Answer

Removed the automatic Shadowfax booking retry that replaced configured pickup pincode 282006 with 110060 while retaining Agra address fields. On pickup-pincode rejection, bookShadowfaxOrder now returns an actionable account-mapping error and submits no second request. Removed the settings UI hub shortcut and documented exact-address behavior. Added a regression test asserting one request and unchanged pickup/RTO pincode. Deployed live at commit 001779a; 55 tests, lint, production build, and local/public health passed.

## Outcome

- Signal: useful

## Source Nodes

- shadowfax.ts
- bookShadowfaxOrder