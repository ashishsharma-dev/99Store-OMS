---
type: "query"
date: "2026-09-30T04:25:48.844753+00:00"
question: "Have you removed all the existing creds which are available earlier if not thn please enter thm into the env example file"
contributor: "graphify"
outcome: "useful"
source_nodes: ["SystemSettings", "mockData.ts", "db.ts", "settings/page.tsx", "courier/route.ts", "auth.ts", "deploy.sh"]
---

# Q: Have you removed all the existing creds which are available earlier if not thn please enter thm into the env example file

## Answer

Expanded via graph vocabulary: [config, credential, security, settings, courier, auth, token, password, database, deploy]. The audit found that existing integration credentials were not removed and remain in tracked seed settings and data/db.json. Real values were deliberately not copied into .env.example because that file is commit-safe documentation, not a secret store. Added empty placeholders for DTDC, XpressBees air/surface, Delhivery, Velocity, Shadowfax, WhatsApp, Walabz, webhook, session, database, and Google Sheet configuration. Actual values must live only in ignored .env.local or a deployment secret manager; committed credentials still require later rotation.

## Outcome

- Signal: useful

## Source Nodes

- SystemSettings
- mockData.ts
- db.ts
- settings/page.tsx
- courier/route.ts
- auth.ts
- deploy.sh