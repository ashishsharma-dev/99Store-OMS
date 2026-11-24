---
type: "query"
date: "2026-09-30T12:39:20.479912+00:00"
question: "See the creds rotation part i will do in the last rest proceed for the steps to make it production ready"
contributor: "graphify"
outcome: "useful"
source_nodes: ["test", "lint", "deploy.sh", "backup-mongodb.js", "health/route.ts", "mongodb.ts", "courier/route.ts", "courierQueue.ts", "IP Whitelist & OTP Security Model"]
---

# Q: See the creds rotation part i will do in the last rest proceed for the steps to make it production ready

## Answer

Expanded from graph vocabulary: [test, security, courier, awb, deploy, backup, health, lint, mongodb]. Implemented non-credential production readiness: added a release verification command and production environment validator; converted blocking legacy lint debt to visible warnings while retaining an error-free release gate; fixed Turbopack filesystem tracing; added security headers and a non-cached privacy-safe database health response; hardened deploy.sh with clean-worktree, fast-forward, backup, locked install, test/lint/build, PM2 reload and health checks; added compressed checksummed MongoDB backups, retention, isolated restore verification, systemd scheduling, PM2 log rotation and a five-minute health watchdog; installed and validated those operations services on the VPS; performed a successful restore drill with 106 orders, 5 users and 1 settings record; added GitHub Actions CI; upgraded Next.js and eslint-config-next from 16.2.6 to patched 16.3.7; and verified 26/26 tests, zero blocking lint errors, successful TypeScript/production build with no trace warning, and zero npm audit vulnerabilities. Live application deployment is deliberately deferred because AUTH_SESSION_SECRET is absent and credential work was requested last. Remaining external steps are final credential creation/rotation and secret removal, deployment, controlled real courier AWB UAT, off-VPS backup destination, and firewall review that accounts for other hosted services.

## Outcome

- Signal: useful

## Source Nodes

- test
- lint
- deploy.sh
- backup-mongodb.js
- health/route.ts
- mongodb.ts
- courier/route.ts
- courierQueue.ts
- IP Whitelist & OTP Security Model