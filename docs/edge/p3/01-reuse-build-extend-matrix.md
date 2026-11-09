# P3 — Reuse / Build / Extend Matrix

| Capability | Decision | Evidence / target |
|------------|----------|-------------------|
| Edge auth / RBAC / workspace | **REUSE** | P0 guards + `edge_permissions` |
| Product commercial availability gate | **REUSE** | P1 `edge_products.commercial_availability` |
| ICP / persona / market / plan refs | **REUSE** | P2 commercial tables + ports |
| CP outbox | **REUSE** | `ControlPlaneOutboxTransactionService` |
| Edge console shell / states / gates | **REUSE** | `edge-shell`, `EdgePermissionGate`, states |
| Edge BFF CSRF for admin APIs | **REUSE** | `/api/edge-backend/**` |
| Marketing strategies / audiences / campaigns | **BUILD** | `077` + `domain/marketing` |
| Content / landing pages / forms | **BUILD** | `077` + use cases |
| Lead registry / dedup / consent / scoring | **BUILD** | `077` + domain scoring |
| Public form submission surface | **BUILD** | `@Public()` API + dedicated FE public proxy |
| Channel adapters (email/WhatsApp/ads) | **BUILD** (ports first) | No fake delivery confirmations |
| Journey engine | **BUILD** (later increment) | Deterministic execution |
| Attribution models | **BUILD** (later increment) | Measured vs unavailable |
| Budget governance | **BUILD** (foundation tables now) | Not accounting SoT |
| Tenant CRM campaigns | **DO NOT REUSE** | Separate plane |
| Second product catalog | **FORBIDDEN** | — |
| Entitlement / billing / tenant create from forms | **FORBIDDEN** | — |
