---
type: "query"
date: "2026-10-14T17:45:45.139654+00:00"
question: "Trace WhatsApp dispatch, tracking event freshness and duplicate OFD, and Shadowfax/XpressBees serviceability errors"
contributor: "graphify"
outcome: "useful"
source_nodes: ["courierSync.ts", "whatsapp.ts", "serviceability/route.ts"]
---

# Q: Trace WhatsApp dispatch, tracking event freshness and duplicate OFD, and Shadowfax/XpressBees serviceability errors

## Answer

Expanded from graph vocabulary: whatsapp tracking event webhook serviceability shadowfax xpressbees. Verified source: bulk sync used unauthenticated loopback, Shadowfax appended repeated history, ETA updates duplicated status rows, screenshot renderer lacked session, and serviceability errors were treated as coverage failures. Added shared internal tracking handler and persistent PM2 polling, event timestamp guards and serialization, authenticated screenshot rendering and provider progress checks, and tri-state account-specific serviceability. Graph source locations predate this refactor; inspect current source for exact lines.

## Outcome

- Signal: useful

## Source Nodes

- courierSync.ts
- whatsapp.ts
- serviceability/route.ts