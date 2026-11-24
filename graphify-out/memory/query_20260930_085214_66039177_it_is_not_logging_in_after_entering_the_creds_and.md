---
type: "query"
date: "2026-09-30T08:52:14.059419+00:00"
question: "It is not logging in after entering the creds and otp"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Login()", "login/route.ts", "send-otp/route.ts", "auth.ts", "db.ts", "mongodb"]
---

# Q: It is not logging in after entering the creds and otp

## Answer

Expanded from graph vocabulary: [login, otp, auth, authenticated, user, username, password, database, mongodb]. Root cause: AUTH_SESSION_SECRET was missing from .env.local. In production, valid OTP verification reached createSessionToken and returned HTTP 500 because session signing requires that secret. Added a strong ignored local session secret. Also changed db.saveUser to await the MongoDB user write, preventing immediate OTP verification from racing persistence. Production session signing, 26 tests, TypeScript, and Next production build pass. Restart the running Next process before retrying.

## Outcome

- Signal: useful

## Source Nodes

- Login()
- login/route.ts
- send-otp/route.ts
- auth.ts
- db.ts
- mongodb