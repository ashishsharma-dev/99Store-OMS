# Graph Report - 99StoreOMSV2  (2026-09-23)

## Corpus Check
- 98 files · ~192,587 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .ico 1, .css 1)

## Summary
- 372 nodes · 833 edges · 18 communities (13 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.85)
- Token cost: 1,250 input · 850 output

## Community Hubs (Navigation)
- NDR & Order State Management
- WhatsApp & Walabz Messaging Service
- Order UI & Thermal Label Components
- Project Dependencies & Lint Config
- Courier API Gateway & Webhooks
- MongoDB Persistence & Database Backups
- Auth, IP Firewall & Security
- TypeScript Build Configuration
- Courier Network Resilience & Tests
- Background Courier Job Queue
- Core Fulfillment & Shipping Specifications
- Python Remote Deployment Automation
- System Architecture & Documentation
- Shell Deployment Scripting
- PostCSS Styling Configuration
- DTDC Courier Protocol Specification
- Delhivery Postman Integration Suite

## God Nodes (most connected - your core abstractions)
1. `next` - 32 edges
2. `db` - 31 edges
3. `Order` - 24 edges
4. `triggerWhatsAppNotification()` - 23 edges
5. `react` - 20 edges
6. `WalabzClient` - 16 edges
7. `getXpressBeesToken()` - 16 edges
8. `compilerOptions` - 16 edges
9. `lucide-react` - 15 edges
10. `bookCourierShipment()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `IP Whitelist & OTP Security Model` --implements--> `User`  [EXTRACTED]
  DOCUMENTATION.md → src/lib/types.ts
- `End-to-End Order Workflow` --implements--> `Order`  [EXTRACTED]
  DOCUMENTATION.md → src/lib/types.ts
- `Order Duplication & Repeat Order Flow` --references--> `Order`  [EXTRACTED]
  graphify-out/converted/Additional Req_b73b8f77.md → src/lib/types.ts
- `Partial Payment & Green Highlight Rule` --references--> `Order`  [EXTRACTED]
  graphify-out/converted/Additional Req_b73b8f77.md → src/lib/types.ts
- `Non-Delivery Report (NDR) Management` --implements--> `NdrRecord`  [EXTRACTED]
  DOCUMENTATION.md → src/lib/types.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Order Processing and Fulfillment Lifecycle** — src_lib_types_order, documentation_order_workflow, documentation_courier_routing, documentation_whatsapp_automation, documentation_ndr_escalation_system [INFERRED 0.95]
- **Multi-Carrier Shipping Integrations** — documentation_courier_routing, dtdc_integration_spec, postman_delhivery_manual_setup, src_lib_xpressbees [INFERRED 0.95]
- **Advanced Operational Workflow Requirements** — req_partial_payment, req_clone_order, req_ofd_working_sheet, req_ndr_working_sheet [INFERRED 0.85]

## Communities (18 total, 5 thin omitted)

### Community 0 - "NDR & Order State Management"
Cohesion: 0.05
Nodes (37): Non-Delivery Report (NDR) Management, nextConfig, next, NDR Working Sheet & Action Schedule, mapShadowfaxEventToOrderStatus(), POST(), POST(), dynamic (+29 more)

### Community 1 - "WhatsApp & Walabz Messaging Service"
Cohesion: 0.07
Nodes (26): WhatsApp Customer Notification Service, ref_child_process, puppeteer-core, GET(), POST(), POST(), PATCH(), POST() (+18 more)

### Community 2 - "Order UI & Thermal Label Components"
Cohesion: 0.13
Nodes (29): lucide-react, react, Order Duplication & Repeat Order Flow, Partial Payment & Green Highlight Rule, NdrManagement(), OfdManagement(), Orders(), Packing() (+21 more)

### Community 3 - "Project Dependencies & Lint Config"
Cohesion: 0.06
Nodes (35): eslintConfig, dependencies, lucide-react, mongodb, next, puppeteer-core, react, react-dom (+27 more)

### Community 4 - "Courier API Gateway & Webhooks"
Cohesion: 0.14
Nodes (29): GET(), POST(), GET(), pincodeCache, pincodeMap, checkCourierServiceabilityFallback(), GET(), POST() (+21 more)

### Community 5 - "MongoDB Persistence & Database Backups"
Cohesion: 0.08
Nodes (21): ref_dns, ref_fs, mongodb, ref_path, dns, fs, { MongoClient }, path (+13 more)

### Community 6 - "Auth, IP Firewall & Security"
Cohesion: 0.11
Nodes (17): IP Whitelist & OTP Security Model, ref_crypto, POST(), PATCH(), POST(), DashboardLayout(), playAudioFeedback(), MessagesPage() (+9 more)

### Community 7 - "TypeScript Build Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 8 - "Courier Network Resilience & Tests"
Cohesion: 0.27
Nodes (10): ref_node_assert, ref_node_test, inFlightSyncAwbs, POST(), FetchRetryConfig, fetchWithRetry(), getErrorCategory(), HttpError (+2 more)

### Community 9 - "Background Courier Job Queue"
Cohesion: 0.36
Nodes (6): POST(), enqueueBulkJob(), processCourierJobs(), startCourierQueueProcessor(), triggerCourierQueueProcessor(), BulkJob

### Community 10 - "Core Fulfillment & Shipping Specifications"
Cohesion: 0.33
Nodes (6): Delhivery Pincode Serviceability Check, Multi-Courier Routing Engine, End-to-End Order Workflow, DTDC AWB & Shipping Label Generation, Order Management Software SRS, Out For Delivery (OFD) Team Assignment

### Community 11 - "Python Remote Deployment Automation"
Cohesion: 0.40
Nodes (5): paramiko, main(), run_local(), subprocess, sys

### Community 12 - "System Architecture & Documentation"
Cohesion: 0.67
Nodes (3): Next.js Architecture Conventions, 99Store OMS Architecture, 99Store OMS Overview & Setup

## Knowledge Gaps
- **109 isolated node(s):** `deploy.sh script`, `eslintConfig`, `nextConfig`, `name`, `version` (+104 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 159 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `NDR & Order State Management` to `WhatsApp & Walabz Messaging Service`, `Order UI & Thermal Label Components`, `Project Dependencies & Lint Config`, `Courier API Gateway & Webhooks`, `Auth, IP Firewall & Security`, `Courier Network Resilience & Tests`, `Background Courier Job Queue`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Why does `Order` connect `Order UI & Thermal Label Components` to `NDR & Order State Management`, `WhatsApp & Walabz Messaging Service`, `Courier API Gateway & Webhooks`, `Auth, IP Firewall & Security`, `Core Fulfillment & Shipping Specifications`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `triggerWhatsAppNotification()` (e.g. with `.normalizePhoneNumber()` and `.sendCampaign()`) actually correct?**
  _`triggerWhatsAppNotification()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `deploy.sh script`, `eslintConfig`, `nextConfig` to the rest of the system?**
  _109 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `NDR & Order State Management` be split into smaller, more focused modules?**
  _Cohesion score 0.05029838022165388 - nodes in this community are weakly interconnected._
- **Should `WhatsApp & Walabz Messaging Service` be split into smaller, more focused modules?**
  _Cohesion score 0.06711915535444947 - nodes in this community are weakly interconnected._
- **Should `Order UI & Thermal Label Components` be split into smaller, more focused modules?**
  _Cohesion score 0.13019607843137254 - nodes in this community are weakly interconnected._