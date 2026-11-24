---
type: "query"
date: "2026-11-04T08:18:53.351966+00:00"
question: "Resend the pending whatsapp messages and clear the pending queue"
contributor: "graphify"
outcome: "useful"
source_nodes: ["WalabzClient", "whatsapp.ts", "CampaignResult"]
---

# Q: Resend the pending whatsapp messages and clear the pending queue

## Answer

Expanded from original query via graph vocab: [whatsapp, campaign, queue, pending, retry, walabz, message, order, template, delete]. Audited 98 Labzwaba campaigns with zero sent/delivered/read. Provider refused deletion of preparing shells and exposes no cancel endpoint. Retired 93 order events locally, expired 5 OTPs, deduplicated to 90 replays, fixed packing-slip rendering by replacing networkidle0 with DOM plus label readiness, and verified zero remaining OMS pending/preparing campaigns. Final media retries: 17 delivered, 2 sent, 1 read, 1 failed as Known non-WhatsApp number.

## Outcome

- Signal: useful

## Source Nodes

- WalabzClient
- whatsapp.ts
- CampaignResult