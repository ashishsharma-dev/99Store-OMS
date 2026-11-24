---
type: "query"
date: "2026-11-02T09:34:10.701501+00:00"
question: "Check for this issue and make a solution for the same, its a dispatch message failure check once"
contributor: "graphify"
outcome: "useful"
source_nodes: ["generatePackingSlipImage()", "screenshot.ts", "whatsapp.ts", "WalabzClient", "Order"]
---

# Q: Check for this issue and make a solution for the same, its a dispatch message failure check once

## Answer

Expanded from original query via graph vocab: [whatsapp, message, label, image, webhook, walabz, template, order, screenshot, url, error]. Production log for order 99S-1208 showed media URL https://localhost:3000/packing-slips/99S-1208.png, causing Meta error 131053 HTTP 403. Public /packing-slips URLs also returned 404 because runtime-generated files were not reliably served by the Next.js production public asset pipeline. Implemented an expiring HMAC-signed runtime media route, rejected private/insecure origins, added an HTTP image preflight before campaign creation, kept media campaigns queued until reconciliation, and reconciled recent Sent messages for late failures. Deployed b8e0001; exact signed endpoint returned HTTP 200 image/png with 175986 bytes. Corrected the historical campaign log to Failed with Media upload error.

## Outcome

- Signal: useful

## Source Nodes

- generatePackingSlipImage()
- screenshot.ts
- whatsapp.ts
- WalabzClient
- Order