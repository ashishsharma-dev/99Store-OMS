---
type: "query"
date: "2026-10-17T08:03:16.343502+00:00"
question: "whatsapp otp walabz login authentication campaign fetch"
contributor: "graphify"
outcome: "useful"
source_nodes: ["src_lib_walabz_walabzclient_getauthtoken", "src_lib_whatsapp_sendloginotp"]
---

# Q: whatsapp otp walabz login authentication campaign fetch

## Answer

Live WhatsApp login OTP follows src/app/api/auth/send-otp/route.ts to sendLoginOTP in src/lib/whatsapp.ts to WalabzClient.getAuthToken in src/lib/walabz.ts. Production credentials and OTP phone are present. On 2026-10-17 the VPS resolves walabz.com, but TLS presents a certificate for ayunatura.store and Node fetch fails with ERR_TLS_CERT_ALTNAME_INVALID before authentication. Recent login_otp sends succeeded on 2026-10-14, so the current outage is caused by Walabz DNS, TLS, or virtual-host configuration, not missing OMS credentials.

## Outcome

- Signal: useful

## Source Nodes

- src_lib_walabz_walabzclient_getauthtoken
- src_lib_whatsapp_sendloginotp