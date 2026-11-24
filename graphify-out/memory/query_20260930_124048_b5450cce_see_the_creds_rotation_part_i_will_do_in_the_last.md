---
type: "query"
date: "2026-09-30T12:40:48.995916+00:00"
question: "See the creds rotation part i will do in the last rest proceed for the steps to make it production ready"
contributor: "graphify"
outcome: "corrected"
correction: "Next.js 16.3.7 is the latest published npm version and currently audits clean; official Next.js guidance lists 16.3.8 as the planned security release, so recheck the registry immediately before final deployment."
source_nodes: ["test", "lint", "deploy.sh", "backup-mongodb.js", "health/route.ts", "mongodb.ts", "courier/route.ts"]
---

# Q: See the creds rotation part i will do in the last rest proceed for the steps to make it production ready

## Answer

Expanded from graph vocabulary: [test, security, courier, awb, deploy, backup, health, lint, mongodb]. Non-credential production work is complete and verified. Correction to the earlier result: Next.js 16.3.7 is the latest version currently published in npm and the project audit reports zero vulnerabilities, but the official Next.js security notice now says 16.3.8 is the planned September 30 patched release and it is not yet present in the npm registry. Recheck and upgrade immediately before the final production deployment. Live source deployment remains deferred because AUTH_SESSION_SECRET is intentionally pending the final credential phase.

## Outcome

- Signal: corrected
- Correction: Next.js 16.3.7 is the latest published npm version and currently audits clean; official Next.js guidance lists 16.3.8 as the planned security release, so recheck the registry immediately before final deployment.

## Source Nodes

- test
- lint
- deploy.sh
- backup-mongodb.js
- health/route.ts
- mongodb.ts
- courier/route.ts