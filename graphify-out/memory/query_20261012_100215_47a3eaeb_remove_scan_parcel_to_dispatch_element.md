---
type: "query"
date: "2026-10-12T10:02:15.701616+00:00"
question: "Remove Scan parcel to dispatch element"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Packing()"]
---

# Q: Remove Scan parcel to dispatch element

## Answer

Expanded graph terms: packing barcode order. Graph located Packing in src/app/dashboard/packing/page.tsx. Removed scanner form, local scanner state and submit handler only; retained label barcodes and backend dispatch API. Tests and production build pass.

## Outcome

- Signal: useful

## Source Nodes

- Packing()