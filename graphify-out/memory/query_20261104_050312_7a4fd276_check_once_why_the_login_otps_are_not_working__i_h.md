---
type: "query"
date: "2026-11-04T05:03:12.203640+00:00"
question: "Check once why the login otps are not working, i have checked the dashboard of labzwaba thn it shows some messages are in preparing status, check once and let me know the solution or one more thing if we can do email otp implementation do let me know"
contributor: "graphify"
outcome: "useful"
source_nodes: ["sendLoginOTP()", "send-otp/route.ts", "WalabzClient", ".getCampaignProgress()", "Login()"]
---

# Q: Check once why the login otps are not working, i have checked the dashboard of labzwaba thn it shows some messages are in preparing status, check once and let me know the solution or one more thing if we can do email otp implementation do let me know

## Answer

Expanded from original query via graph vocab: [login, otp, send, whatsapp, walabz, campaign, progress, status, auth, message]. Production evidence shows the approved login authentication template is valid, but four OTP campaigns are stuck in provider status preparing with total=0 and no message rows. There are 84 queued campaigns globally, so Labzwaba campaign processing is stalled. The app also starves newer reconciliation records by repeatedly selecting the oldest queued rows and treats preparing as queued indefinitely. Email OTP is feasible but User currently has no email field; add per-user email, SES delivery, shared OTP expiry/rate limits, and automatic fallback.

## Outcome

- Signal: useful

## Source Nodes

- sendLoginOTP()
- send-otp/route.ts
- WalabzClient
- .getCampaignProgress()
- Login()