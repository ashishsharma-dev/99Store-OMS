---
type: "query"
date: "2026-10-05T15:27:02.940123+00:00"
question: "Explain variable 1, keep admin Settings login OTP number, poll delivery, show queued/failure, and add resend after 30 seconds"
contributor: "graphify"
outcome: "useful"
source_nodes: ["sendLoginOTP()", ".getCampaignProgress()", "send-otp/route.ts", "Login()", "settings/page.tsx"]
---

# Q: Explain variable 1, keep admin Settings login OTP number, poll delivery, show queued/failure, and add resend after 30 seconds

## Answer

Expanded from graph vocab: [otp, login, auth, send, campaign, progress, walabz, whatsapp, settings, phone]. Implemented and deployed commit ccbe8eb. Authentication template variable 1 is the single {{1}} OTP placeholder; payload now sends only {'1': otp}. Login OTPs require the administrator-controlled Settings otpWhatsappNumber with no user-phone fallback. Walabz campaign creation is followed by brief server polling, signed short-lived client status polling, and Queued/Sent/Failed UI states. Resend unlocks after 30 seconds and is enforced server-side using tempOtpIssuedAt. Verified with 33 tests, lint, production audit, build, PM2, MongoDB, and public/local health.

## Outcome

- Signal: useful

## Source Nodes

- sendLoginOTP()
- .getCampaignProgress()
- send-otp/route.ts
- Login()
- settings/page.tsx