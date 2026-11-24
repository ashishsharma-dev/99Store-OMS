# 99Store OMS — Application Memory & Change Guide

> **Purpose:** This is the durable handover note for anyone operating, debugging, or changing 99Store OMS. Read it before changing code, settings, deployment, courier behavior, authentication, or messaging.
>
> **Security rule:** This document intentionally contains no passwords, tokens, phone numbers, database URLs, server IPs, or customer data. Keep secrets only in the production environment/secret manager; never put them in Git, tickets, screenshots, logs, or this document.

## 1. What this application is

99Store OMS is an internal order-management and fulfillment application. It supports the end-to-end flow from order creation to courier booking, label generation, dispatch messaging, courier tracking, OFD/NDR handling, user activity history, and operational reporting.

The application is a single Next.js App Router service backed primarily by MongoDB in production. It has a JSON-backed local fallback for development and recovery workflows. Production is run as a single PM2 process on a VPS; that single-process model is important because it hosts the in-process tracking and WhatsApp reconciliation schedulers.

### Main operational flow

```text
Create order
  → select / auto-route courier
  → select shipment contact
  → create courier booking + AWB
  → generate label
  → send WhatsApp dispatch template (with label when the template supports it)
  → dispatch
  → scheduled courier tracking / webhook update
  → OFD / NDR / delivery / return handling
  → order history + Activity Logs
```

## 2. Technology and repository map

| Area | Details |
| --- | --- |
| Framework | Next.js 16.4.3, React 19, TypeScript, App Router |
| UI | React pages under `src/app`, CSS in `src/app/globals.css`, Lucide icons |
| Data | MongoDB in production; `data/db.json` as local/runtime fallback |
| Process manager | PM2, app name `99store-oms`, port 3000 |
| Tests | Node test runner via `tsx --test tests/*.test.ts` |
| Main public site | `https://oms.ayurvedacare.store` |
| Production health endpoint | `/api/health` |

### Key locations

| Concern | Primary files |
| --- | --- |
| Domain models | `src/lib/types.ts` |
| Data access and local fallback | `src/lib/db.ts`, `src/lib/mongodb.ts` |
| Integration secret hydration/redaction | `src/lib/integrationSecrets.ts` |
| Authentication/session | `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/authorization.ts` |
| Edge-style route protection | `src/proxy.ts` |
| Order API | `src/app/api/orders/route.ts`, `src/app/api/orders/[id]/route.ts` |
| Courier booking | `src/lib/courierHelper.ts`, `src/lib/courierQueue.ts` |
| Tracking/status normalization | `src/lib/courierTrackingHandler.ts`, `src/lib/courierSync.ts`, `src/lib/trackingScheduler.ts` |
| Courier-specific code | `src/lib/dtdcTracking.ts`, `src/lib/dtdcBooking.ts`, `src/lib/xpressbees.ts`, `src/lib/shadowfax.ts`, `src/lib/delhiveryTracking.ts` |
| Shipment-contact selection | `src/lib/shipmentContact.ts` |
| WhatsApp | `src/lib/whatsapp.ts`, `src/lib/walabz.ts`, `src/lib/whatsappReconciliation.ts`, `src/lib/whatsappQueue.ts` |
| Packing-label media | `src/lib/packingSlipMedia.ts`, `src/app/api/media/packing-slip/[orderId]/route.ts` |
| Notification feed | `src/app/api/notifications/stream/route.ts`, `src/lib/notificationSnapshot.ts` |
| Activity-history API | `src/app/api/activity-logs/route.ts` |
| Production release | `scripts/vps-release.py`, `ecosystem.config.js` |
| Backups/monitoring | `scripts/backup-mongodb.sh`, `scripts/verify-mongodb-backup.sh`, `ops/` |
| Tests | `tests/` |

## 3. App modules and roles

### Dashboard modules

- **Orders:** create, edit, search, export, assign, and delete allowed orders.
- **Packing:** choose courier and shipment contact, queue/bulk-create AWBs, generate labels, and dispatch.
- **Shipments / Tracking:** courier events, status, tracking timeline, retry/sync controls.
- **OFD Management:** active OFD records, delivery progress, notes, attempt count, and AWB contact source.
- **NDR Management:** non-delivery records, re-attempt/return handling, notes, and AWB contact source.
- **Messages:** internal user messages and Super Admin broadcasts.
- **Activity Logs:** all order-history and NDR-history activity. The notification drawer intentionally shows only the rolling last 24 hours; the page is the historical view.
- **Settings:** courier activation/configuration, dispatch numbers, WhatsApp configuration, integration configuration, and logs.
- **Users:** Super Admin-only user lifecycle management.

### Roles

| Role | Main access |
| --- | --- |
| Super Admin | All modules, settings, user management, logs, privileged operations |
| Order Team | Order creation and approved order lifecycle operations |
| Packing Team | Packing queue, AWB generation, label/dispatch operations |
| Tracking Team | Tracking, OFD, NDR workflows |
| Accounts Team | Dashboard/report/export-oriented access |

The UI hides unavailable modules, but this is not the security boundary. Every sensitive API route must also authorize the signed session server-side.

## 4. Authentication and security model

- Login uses a six-digit WhatsApp OTP. OTPs are stored as hashes and have expiry.
- Successful login creates a signed, HTTP-only session cookie.
- `src/proxy.ts` protects dashboard, packing-slip, and non-public API routes. It also removes user-controlled identity headers and supplies identity headers derived from the session.
- `getActiveSession()` re-checks that the user is active and matches the signed session before privileged API work.
- Login is rate-limited and optional IP allowlisting is enforced server-side.
- Webhook endpoints are public by design but must verify the matching webhook signature. Unsigned webhooks are only permissible under a development-only switch.
- Development OTP and Super Admin bypasses are explicitly disabled when `NODE_ENV=production`. Do not weaken this behavior.
- Super Admin recovery requires both explicit enablement and a unique 32+ character recovery secret. Treat it as break-glass access, not ordinary login.

### Secret-handling rules

1. Environment variables take precedence over database settings for integration secrets.
2. `applyIntegrationSecrets()` hydrates runtime settings; `stripIntegrationSecrets()` must be used before persistence/backup paths that should not carry secrets.
3. Never return secret values from API responses, log them, commit them, or place them in `data/db.json`.
4. Do not use the legacy `scripts/deploy.py` as a release mechanism. It embeds operational access details and resets server worktree changes. Use `scripts/vps-release.py`.

### Credential inventory and safe access procedure

Actual credential values must **not** be written in this repository, `data/db.json`, Markdown files, Git commits, screenshots, terminal captures, or chat messages. Store and retrieve them only from the approved production secret store / protected VPS environment file with authorized access.

The following inventory is what an authorized maintainer needs to locate or rotate:

| Purpose | Environment variable(s) | Used by |
| --- | --- | --- |
| Application session signing | `AUTH_SESSION_SECRET` | `src/lib/session.ts` and authenticated API access |
| MongoDB | `MONGODB_URI`, `USE_MONGODB` | `src/lib/mongodb.ts`, `src/lib/db.ts` |
| Public app/media URLs | `APP_PUBLIC_URL`, `NEXT_PUBLIC_APP_URL`, `PACKING_SLIP_MEDIA_SECRET` | label media and WhatsApp label delivery |
| Walabz WhatsApp | `WALABZ_BASE_URL`, `WALABZ_USERNAME`, `WALABZ_PASSWORD`, `WALABZ_API_KEY` | `src/lib/walabz.ts`, `src/lib/whatsapp.ts` |
| Legacy WhatsApp fields | `WHATSAPP_DEVICE_ID`, `WHATSAPP_ACCESS_TOKEN` | integration compatibility only |
| DTDC booking/tracking | `DTDC_API_KEY`, `DTDC_USERNAME`, `DTDC_PASSWORD`, `DTDC_ACCESS_TOKEN`, `DTDC_CUSTOMER_CODE` | DTDC booking and tracking |
| XpressBees | `XPRESSBEES_API_KEY`, `XPRESSBEES_EMAIL`, `XPRESSBEES_PASSWORD`, `XPRESSBEES_SECRET_KEY`, `XPRESSBEES_XB_KEY`, plus `XPRESSBEES_AIR_*` and `XPRESSBEES_SURFACE_*` | XpressBees Air/Surface booking and tracking |
| Delhivery | `DELHIVERY_API_KEY` | Delhivery booking/tracking |
| Shadowfax | `SHADOWFAX_API_KEY` | Shadowfax booking/tracking/serviceability |
| Webhook validation | `DTDC_WEBHOOK_SECRET`, `SHADOWFAX_WEBHOOK_SECRET`, `COURIER_WEBHOOK_SECRET` | inbound courier callback verification |
| Google Sheets | `GOOGLE_SHEET_WEBHOOK_URL` | optional order sync |
| Recovery access | `ENABLE_SUPERADMIN_RECOVERY`, `SUPERADMIN_RECOVERY_USERNAME`, `SUPERADMIN_RECOVERY_SECRET` | break-glass Super Admin recovery only |

#### Authorized credential work

1. Confirm the operation and exact integration that needs access; do not retrieve unrelated secrets.
2. Take an encrypted MongoDB/configuration backup before a rotation that can affect live traffic.
3. Update the protected VPS environment file or approved secret manager—not settings UI fields or source code.
4. Run `npm run verify:env` without printing values.
5. Test the smallest non-billable/read-only integration action first: health check, authentication, tracking, or serviceability as appropriate.
6. Deploy/reload via `scripts/vps-release.py` only after the new secret is validated.
7. Revoke the old provider credential only after the replacement is proven live.

#### Development-only switches

`DISABLE_OTP`, `ALLOW_UNSIGNED_WEBHOOKS`, `ALLOW_COURIER_SIMULATION`, `NEXT_PUBLIC_ENABLE_DEMO_TOOLS`, `ENABLE_SUPERADMIN_BYPASS`, and `NEXT_PUBLIC_ENABLE_SUPERADMIN_BYPASS` are development-only. They must remain disabled in production. Their presence is not permission to enable them during incident response.

## 5. Data model and data ownership

### Primary collections / entities

| Entity | Important fields / purpose |
| --- | --- |
| `orders` | Order/customer details, status, AWB, courier, contact selection, booking state, courier tracking fields, immutable-ish history |
| `ndr` | NDR reason/status/notes/history, AWB, and persisted booking contact source |
| `users` | User identity, role, active flag, OTP state, login metadata |
| `settings` | Non-secret operational settings; secret values are overlaid from environment |
| `whatsappLogs` | Provider campaign/message status, retry/outbox metadata, label-media URL, failure detail |
| `courierLogs` | Request/response diagnostic history for booking, tracking, cancellation, and webhooks |
| `messages` | Internal direct/broadcast messages |
| `bulk_jobs` | Long-running bulk AWB workflow state and per-order outcomes |
| `tracking_events` | Supporting tracking event storage |

### Order statuses

`Created` → `Packing` / `Courier Selected` → `Label Generated` → `Dispatched` → `OFD` → `Delivered`

Exception/retry states include `Call Placed Notification`, `NDR`, `Undelivered`, `RDC`, and `Return`. Never force a later status over a more final one without checking the status-normalization and event-time safeguards.

### History is important

Order history and NDR history are operational audit trails. The Activity Logs feature aggregates these records; it is not a separate canonical event store. Preserve timestamps, updater identity, and meaningful remarks when adding status-changing code.

## 6. Shipment contacts: the four-number model

There are four configurable dispatch-number arrays in settings:

1. Primary
2. Secondary
3. Additional 1
4. Additional 2

Orders persist copies in `phonePrimary`, `phoneSecondary`, `phoneAdditional1`, and `phoneAdditional2`, alongside customer (`phoneTertiary`) and WhatsApp (`phoneWhatsApp`) numbers.

When an AWB is created, the selected booking number and its source must be persisted as:

- `shipmentContactPhone`
- `shipmentContactType`

Valid types are `Primary`, `Secondary`, `Additional 1`, `Additional 2`, `Customer`, `WhatsApp`, and `Custom`.

This data must flow through the packing UI, bulk queue, direct booking path, courier payload, order record, NDR record, OFD/NDR display, and Activity Logs. Do not infer the source after booking if it can be stored at booking time.

### Legacy records

Older AWBs may not have persisted contact-source metadata. The UI currently displays `Not recorded (legacy)` for those entries. A future backfill should prefer the original courier booking log; if unavailable, show an explicitly labeled inferred contact rather than presenting a guess as confirmed fact.

## 7. Courier architecture and operational cautions

### Shared rules

- Courier booking is an external side effect. Never blindly retry a request after a timeout/ambiguous result; reconcile first to avoid duplicate AWBs.
- Keep request/response logs redacted of secrets but sufficiently detailed to diagnose a carrier rejection.
- Respect `courierBookingStatus`, attempt IDs, and reconciliation-required states.
- The packing bulk processor is in-process and uses controlled concurrency. Do not turn it into uncontrolled parallel booking.
- Tracking data can arrive out of order. Event-time code prevents status regression and duplicate OFD attempts; preserve those protections.

### DTDC

- Booking uses the production PX/Shipsy soft-data endpoint in `courierHelper.ts`; tracking uses the DTDC tracking/auth flow.
- `serviceTypeId`, `commodityId`, customer code, and origin configuration affect booking eligibility.
- **Known operational issue, verified 5 November 2026:** tracking and credentials were healthy, while bookings failed mostly due to DTDC `NO_SERIES_AVAILABLE`, alongside special-destination, COD-ineligible, invalid/unserviceable pincode, and office-not-found responses.
- `NO_SERIES_AVAILABLE` is an account/carrier AWB-series allocation issue. It requires DTDC to replenish/map the correct series for the customer account and service.
- The current app DTDC serviceability fallback is only a static pincode-prefix heuristic. It is insufficient for production routing because DTDC differentiates B2C, B2C COD, special destination, remote area, and service type. Any courier-routing change should integrate the live DTDC pincode result before booking and fall back safely to another eligible courier.
- Do not interpret a DTDC tracking origin such as Lucknow as the consignee address; those early tracking scans can represent DTDC internal pickup assignment metadata. Use explicit destination fields/scans for destination presentation.

### XpressBees

- Supports distinct Air and Surface credentials/configuration.
- Preserve account-specific credential selection, token behavior, manifest validation, and live serviceability handling.

### Delhivery

- Supports booking/tracking/labels and special `Call Placed Notification` handling.
- Do not turn a call-placed event into a delivery/failed-delivery event.

### Shadowfax

- Supports warehouse/marketplace behavior and live serviceability checks.
- Unknown courier statuses must remain preserved as unknown milestones rather than becoming a tracking failure. Historical mapping includes `Bag Received`.
- Webhooks should extract delivery-agent data only from courier-specific fields and never mistake consignee phone numbers for rider numbers.

## 8. Tracking, webhooks, OFD, and NDR

### Scheduled tracking

`src/instrumentation.ts` starts the scheduler only in production, Node.js runtime, and not during the production build phase. With `COURIER_TRACKING_POLL_ENABLED=true`, active non-final AWBs are checked every minute in small batches.

The application is intentionally configured for one PM2 instance. If scaling to multiple Node instances, move scheduling/queue locking to a shared job system before increasing `instances`, or duplicate tracking/reconciliation work will occur.

### Webhooks

- DTDC: `src/app/api/webhooks/dtdc/tracking/route.ts`
- Generic courier: `src/app/api/integrations/courier/webhook/route.ts`
- Shadowfax: `src/app/api/webhooks/shadowfax/route.ts` and the integration-specific route

All production webhook providers must be configured with their matching signing secret. When implementing a new webhook, verify signature before JSON processing and make processing idempotent.

### OFD attempts

Adding notes must not increase OFD attempts. Attempt count represents actual qualifying transitions into OFD. Keep `src/lib/ofdAttempts.ts` and its tests as the source of truth.

## 9. WhatsApp / Walabz integration

### What is sent

WhatsApp notifications support lifecycle events such as created, dispatched, OFD, delivered, NDR, RDC, and login OTP. Template mappings are stored in settings; provider credentials remain environment-backed.

Dispatch messaging can attach the generated packing-label image only when the selected approved template has a valid image/media header. A text-only template must fail clearly rather than silently dropping the label.

### Queue and reconciliation

- Outbound records are stored in `whatsappLogs`.
- The reconciliation scheduler periodically checks provider campaign status and updates sent/delivered/read/failed states.
- Login OTPs are prioritized and use resend cooldown/rate-limit safeguards.
- Provider `preparing`/`queued` campaigns can trigger circuit-breaking behavior to avoid piling more work onto a blocked provider queue.
- Reconcile old provider-owned campaigns before replaying; do not resend blindly where delivery status is unknown.
- If a media URL fails with a provider-side 403, ensure the public label-media URL is HTTPS, externally reachable, valid for the provider fetch window, and not blocked by firewall/proxy rules.

### Template category safeguard

The application expects authentication templates for OTP and utility templates for operational notifications. If the provider reports a different category, preserve and report the mismatch; this is often provider/template configuration rather than an application-code error.

## 10. Notifications and Activity Logs

- The bell drawer fetches and displays rolling 24-hour **order/NDR activity** plus live stream events.
- `View More` opens the Activity Logs page, which is intentionally restricted to order and notification activity rather than all application logs.
- Activity history is queried server-side with search, type/date filtering, sort, and pagination. Avoid reverting it to client-side loading of all orders.
- The SSE route must export only supported Next.js route exports. Reusable helpers belong in `src/lib/`, such as `notificationSnapshot.ts`; exporting arbitrary helpers from a route module breaks Next.js 16 route validation.

## 11. Performance rules

1. Query orders with pagination, server-side filtering, and server-side sort. Do not request 10,000–100,000 records just to filter in the browser.
2. Use full skeletons only for first load. Retain current content during filtering/background refreshes.
3. Courier logs need an index on `{ timestamp: -1 }` in MongoDB. Keep log queries scoped and paginated.
4. Settings should not block on provider template/log retrieval. Load non-critical integration data in the background.
5. Do not aggregate unbounded courier logs into the settings page or browser memory.

## 12. Local development

### Required commands

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Before submitting a change:

```powershell
npm run test
npm run lint -- --quiet
npx tsc --noEmit
npm run build
```

`npm run verify` runs test, lint, and the default build together. If Turbopack encounters a local filesystem permission problem in a scratch/dependency directory, try `npx next build --webpack` to distinguish an environment issue from an application error; do not delete unknown user files to make a build pass.

### Next.js requirement

This repository uses a newer, breaking-release Next.js version. Before changing App Router conventions, route handlers, loading behavior, caching, navigation, or build configuration, read the relevant guide under `node_modules/next/dist/docs/` and follow current deprecation notices.

## 13. Safe production deployment

### Release process

Use the guarded release script:

```powershell
python scripts/vps-release.py preflight
python scripts/vps-release.py deploy <commit-sha>
```

It performs a VPS preflight, preserves runtime data and label files, creates a MongoDB/environment rollback snapshot, fast-forwards the exact commit, installs locked dependencies, runs environment checks/tests/lint/audit/build, reloads PM2, and confirms both local and public health. A failed release invokes automatic rollback.

Before deploy:

1. Inspect `git status --short`.
2. Stage and commit only the intended feature files.
3. Preserve unrelated worktree changes; never use `git add .`, `git reset --hard`, or blanket checkout in a dirty workspace.
4. Push the exact release commit to `origin/master`.
5. Run preflight, then deploy by commit SHA.

### Runtime files that must be preserved

- `data/db.json`
- `public/packing-slips/`
- `.env.local` on the VPS

These are operational/runtime state, not ordinary release artifacts. The release script explicitly handles them.

### Operational verification after release

- Confirm `/api/health` returns `status: healthy` and `database: connected`.
- Confirm PM2 process `99store-oms` is online.
- Confirm the release commit on the VPS matches the intended SHA.
- Spot-test a non-destructive authenticated workflow: sign in, open packing, open Activity Logs, and view an existing tracked order.
- Do not test booking by creating a real shipment unless explicitly authorized; courier booking is billable/irreversible external work.

## 14. Backups and recovery

- MongoDB backup: `scripts/backup-mongodb.sh`
- Backup verification drill: `scripts/verify-mongodb-backup.sh`
- Monitoring setup: `ops/install-monitoring.sh`
- Backup timer setup: `ops/install-backup-service.sh`
- Release rollback scripts are created in the VPS rollback directory by `vps-release.py`.

Backups must be encrypted/private, retained according to policy, copied off-VPS, and periodically restored to an isolated database as a drill. A backup that has never been restored is not a verified recovery plan.

## 15. Tests that protect critical behavior

| Test area | Examples |
| --- | --- |
| Auth/security | `security.test.ts`, `otpDispatch.test.ts`, `integrationSecrets.test.ts` |
| Courier reliability | `courierReliability.test.ts`, `courierFetch.test.ts`, `dtdcBooking.test.ts`, `dtdcTracking.test.ts` |
| Status correctness | `shipmentUpdates.test.ts`, `courierCallPlaced.test.ts`, `ofdAttempts.test.ts` |
| Contact selection | `shipmentContact.test.ts`, `courierPhonePayload.test.ts` |
| WhatsApp | `whatsappQueue.test.ts`, `whatsappReconciliation.test.ts`, `walabzCampaigns.test.ts`, `packingSlipMedia.test.ts` |
| Notifications/dispatch | `notificationStream.test.ts`, `dispatchScan.test.ts` |

When fixing a production issue, add a regression test at the decision boundary that failed—not only a UI test. Typical examples are a new carrier status, webhook replay, booking error classification, template media shape, or stale queue response.

## 16. Known risks and current technical debt

1. **DTDC booking availability:** The most urgent current operational risk. Live tracking can be healthy while booking fails due to the DTDC account’s AWB-series allocation or destination restrictions. Improve routing before automatically retrying DTDC failures.
2. **DTDC live serviceability:** Replace the static heuristic with DTDC’s live pincode eligibility data, including B2C, COD, special-destination, and remote-area flags.
3. **In-process schedulers:** Fine for the current single PM2 instance; unsafe for horizontal scaling without distributed locking/job infrastructure.
4. **Legacy contact metadata:** Pre-feature AWBs may lack confirmed contact/source. Backfill only from verified original booking logs; label inference clearly.
5. **Provider-owned queues:** Walabz campaign state is ultimately provider-owned. Never describe a queue as cleared unless reconciliation verifies it reached a terminal state.
6. **Route-module exports:** Next.js 16 validates route exports strictly. Keep supporting code in `src/lib`.
7. **Documentation drift:** `README.md` contains generic scaffold content and references an older `deploy.sh` workflow. This document and `scripts/vps-release.py` are the operational source of truth until README is updated.

## 17. Change checklist

Before any implementation:

- [ ] Read this file, `AGENTS.md`, and affected module tests.
- [ ] Check current `git status`; preserve unrelated user changes.
- [ ] Read the relevant current Next.js bundled docs before changing framework-facing code.
- [ ] Identify whether the change creates an external side effect: AWB, message, label, webhook, or data mutation.
- [ ] Keep secrets/environment configuration out of source and runtime logs.
- [ ] Preserve authorization and role checks at API level.
- [ ] Preserve idempotency, event-time ordering, and status non-regression.
- [ ] Add or update focused tests.
- [ ] Run tests, lint, TypeScript, and a production build.
- [ ] Deploy only via the guarded VPS release workflow after explicit approval.
- [ ] Verify health and the target feature post-release.

## 18. Useful diagnostic practices

- Use `courierLogs` for carrier request/response diagnosis, but do not expose raw payloads containing customer PII outside authorized operations.
- Prefer AWB-scoped, read-only inspections to broad database dumps.
- For a suspected tracking issue, compare the newest provider scan timestamp with `lastCourierEventAt`, order status, history, and the mapping logic.
- For booking failure, distinguish account/configuration errors from destination eligibility errors before altering code or retrying.
- For WhatsApp issues, inspect campaign ID, provider status, last reconciliation time, message-level failure detail, template category, and media URL reachability.
- For activity/notification issues, distinguish the 24-hour bell drawer from the paginated historical Activity Logs page.

---

**Maintainer note:** Update this document whenever a new integration, deployment mechanism, data invariant, security control, or operational incident changes how the system must be safely operated.
