---
type: "query"
date: "2026-09-30T10:33:26.419173+00:00"
question: "Is it possibile to create a mongo db instance on my vps by using deploy script creds, make sure to not break anything which is running already"
contributor: "graphify"
outcome: "useful"
source_nodes: ["deploy.sh", "mongodb.ts", "getDatabase", "health/route.ts", "backup-mongodb.js"]
---

# Q: Is it possibile to create a mongo db instance on my vps by using deploy script creds, make sure to not break anything which is running already

## Answer

Expanded from graph vocabulary: [deploy, mongo, mongodb, database, backup, health]. Connected read-only using the deploy script SSH credentials. The VPS already runs MongoDB 7.0.43 as an active system service bound only to 127.0.0.1:27017. The OMS is already configured for a localhost MongoDB URI with USE_MONGODB=true, its health endpoint is healthy, and the 99store-oms database contains 106 orders, 5 users, 543 courier logs, 528 WhatsApp logs, 4 messages, and settings. No services, files, firewall rules, ports, PM2 processes, or database data were changed. Do not create a second instance. Remaining security work is a staged backup, dedicated database/admin users, application credential switch and validation, followed by a planned brief Mongo restart to enable authorization; currently authorization is disabled but Mongo is localhost-only.

## Outcome

- Signal: useful

## Source Nodes

- deploy.sh
- mongodb.ts
- getDatabase
- health/route.ts
- backup-mongodb.js