---
type: "implementation"
date: "2026-09-30T05:02:08.265774+00:00"
question: "Migrate embedded credentials out of mockData.ts and data/db.json into .env.local, update the app to consume them, and defer rotation."
contributor: "graphify"
outcome: "useful"
source_nodes: ["SystemSettings", "mockData.ts", "db.ts", "settings/page.tsx", "courier/route.ts", "deploy.sh", "integrationSecrets.ts"]
---

# Q: Migrate embedded credentials out of mockData.ts and data/db.json into .env.local, update the app to consume them, and defer rotation.

## Answer

Migrated 24 integration configuration values into ignored .env.local without exposing them. Redacted tracked mockData.ts and data/db.json, removed legacy credential defaults, added environment hydration and persistence stripping, and added tests. TypeScript, 26 tests, and production build pass. Rotation remains required because historical tracked copies may exist; MongoDB historical settings should also be scrubbed before production.

## Outcome

- Signal: useful

## Source Nodes

- SystemSettings
- mockData.ts
- db.ts
- settings/page.tsx
- courier/route.ts
- deploy.sh
- integrationSecrets.ts