---
type: "architecture"
date: "2026-10-05T14:22:16.357654+00:00"
question: "How is 99Store OMS deployed safely with rollback and database protection?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["deploy.sh", "scripts/vps-release.py", "scripts/backup-mongodb.sh", "src/app/api/health/route.ts"]
---

# Q: How is 99Store OMS deployed safely with rollback and database protection?

## Answer

The release flow snapshots .env.local and runtime data, triggers the MongoDB backup service, records the prior Git commit, installs a one-command rollback script, validates environment/tests/lint/production audit/build, reloads PM2, and requires both local and public health checks. Production release 5c4adfa deployed successfully with rollback to 0eb942d available.

## Outcome

- Signal: useful

## Source Nodes

- deploy.sh
- scripts/vps-release.py
- scripts/backup-mongodb.sh
- src/app/api/health/route.ts