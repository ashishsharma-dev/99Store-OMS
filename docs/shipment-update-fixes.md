# Shipment updates and customer dispatch notifications

These changes require deployment; no production messages or courier bookings were sent while testing.

## Tracking

The existing single-instance PM2 configuration enables `COURIER_TRACKING_POLL_ENABLED=true`. After server startup, active shipments reconcile in batches of five. The next cycle starts 60 seconds after the previous cycle completes; large backlogs and courier timeouts can increase latency. This timer requires a persistent Node server and is not a serverless cron job. Manual sync uses the same internal handler without an unauthenticated HTTP loopback.

Courier webhooks remain the fastest source. Configure their public URLs and signing secrets with each carrier. Polling cannot fetch an event before the carrier exposes it. Supplied event timestamps are preserved (offsetless ISO date-times use India time), stale events are rejected, and duplicate callbacks or ETA changes do not produce duplicate status rows. Genuine OFD attempts separated by NDR remain separate events. Existing historical duplicates are not deleted automatically.

Order writes now await MongoDB persistence before reporting success. AWB synchronization and full polling runs are serialized within the process. Multi-instance hosting would require a distributed lock.

## WhatsApp

Dispatch waits for the send attempt and reports failures to the packing screen. Only the saved customer WhatsApp number is used. Failed logs do not suppress a retry. Packing slip screenshots authenticate locally and are generated only for image-header templates. Set `NEXT_PUBLIC_APP_URL` to the actual public HTTPS origin and configure Chrome/Chromium. A campaign creation response is not proof of delivery: campaign progress determines Sent, Queued, or Failed.

The approved Dispatched template and provider credentials must be valid. Recipient delivery still needs a controlled production verification after deployment.

## Serviceability

Only Shadowfax and XpressBees serviceability behavior changed. Unavailable checks return null (unconfirmed), rather than false. Packing retries these checks every minute and allows booking to perform its final validation. XpressBees Air/Surface use matching account credentials, XBKey, and service. Unknown provider response formats remain unconfirmed rather than inventing coverage.

Shadowfax delivery coverage checks the configured serviceTier (Regular by default, Surface optional), following https://developer.shadowfax.in/docs/reference/serviceability . The destination check does not guarantee pickup/return-leg coverage; the booking API validates the full shipment.

## Verification

Regression tests cover concurrent and replayed OFD events, event times, stale updates, ETA changes, genuine reattempts, failed tracking responses, account selection, serviceability failures, and WhatsApp retry/recipient selection. All provider calls in those tests are mocked. Scratch release snapshots are excluded from TypeScript compilation.
