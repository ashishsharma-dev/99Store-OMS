---
type: "query"
date: "2026-10-05T14:47:18.520931+00:00"
question: "Login Otp is not recieved but showing sent in the ui what can be the reason of this?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["sendLoginOTP()", "send-otp/route.ts", "Login()", ".sendCampaign()", "WalabzClient"]
---

# Q: Login Otp is not recieved but showing sent in the ui what can be the reason of this?

## Answer

Expanded from graph vocab: [otp, send, login, auth, whatsapp, walabz, message, notification, phone, error]. Production evidence: the UI/API treats Walabz campaign acceptance as delivery success. Latest campaign 6ac3...0bfa was recorded Sent locally but Walabz progress is failed with total=0, sent=0, delivered=0. OTP target is the global settings number ending 2192, which overrides the user's phone. The approved authentication template defines only variable 1, while sendLoginOTP submits positional 1 plus named otp and code mappings; project Walabz docs prohibit mixing positional and named variables, making this the likely background preparation failure. Provider exposed no detailed failure row, so mapping mismatch is a strong inference, not a returned error message.

## Outcome

- Signal: useful

## Source Nodes

- sendLoginOTP()
- send-otp/route.ts
- Login()
- .sendCampaign()
- WalabzClient