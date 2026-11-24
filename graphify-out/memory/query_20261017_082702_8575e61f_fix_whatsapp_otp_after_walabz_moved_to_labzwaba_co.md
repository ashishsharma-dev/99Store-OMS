---
type: "query"
date: "2026-10-17T08:27:02.893091+00:00"
question: "Fix WhatsApp OTP after Walabz moved to labzwaba.com"
contributor: "graphify"
outcome: "useful"
source_nodes: ["src_lib_walabz_walabzclient_getauthtoken", "src_lib_whatsapp_sendloginotp"]
---

# Q: Fix WhatsApp OTP after Walabz moved to labzwaba.com

## Answer

Verified https://labzwaba.com from the production VPS: POST /auth/login/api returned 200 with a token; GET /api/templates/list?status=approved returned 200 with 8 templates including login OTP. Updated source defaults and UI references to labzwaba.com. Updated production .env.local, data/db.json settings, and MongoDB 99store-oms settings.walabzBaseUrl, restarted PM2, and confirmed local/public health healthy. Local commit 15f1b9b was created. GitHub push was blocked by automated approval review.

## Outcome

- Signal: useful

## Source Nodes

- src_lib_walabz_walabzclient_getauthtoken
- src_lib_whatsapp_sendloginotp