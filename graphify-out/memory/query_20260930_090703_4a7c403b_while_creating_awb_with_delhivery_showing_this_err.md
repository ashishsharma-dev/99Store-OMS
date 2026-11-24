---
type: "query"
date: "2026-09-30T09:07:03.989124+00:00"
question: "While creating AWB with Delhivery showing this error: The primary database is unavailable, so courier booking was stopped to prevent a duplicate AWB."
contributor: "graphify"
outcome: "useful"
source_nodes: ["courier/route.ts", "db.ts", "mongodb.ts", "getDatabase()", "Order"]
---

# Q: While creating AWB with Delhivery showing this error: The primary database is unavailable, so courier booking was stopped to prevent a duplicate AWB.

## Answer

Expanded from graph vocabulary: [delhivery, courier, awb, database, mongo, mongodb, order, orders]. The failure occurs in claimCourierBooking before Delhivery is called. USE_MONGODB was true, but the hostname in MONGODB_URI returned DNS NXDOMAIN, so the intentional duplicate-AWB safeguard returned unavailable. Switched the local .env.local to USE_MONGODB=false; verified the local booking guard is operational, Delhivery API key is present, and no local orders are stuck in Processing or Reconciliation Required. Restart Next.js before retrying. Production still needs a valid Atlas URI before USE_MONGODB is enabled again.

## Outcome

- Signal: useful

## Source Nodes

- courier/route.ts
- db.ts
- mongodb.ts
- getDatabase()
- Order