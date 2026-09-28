# Master Prompt Coverage — §§1–50 + Vague 5

Verification against the multi-vertical master architecture after Vague 1–4,
gap-closure, §§22–50, and **Vague 5** (real vertical engines + pharma column drop).

**Persistence (intentional, non-negotiable for this codebase):** **PostgreSQL**
DB-per-tenant. **SurrealDB is out of scope** (will not be introduced).
Redis caches `BusinessContext` only.

## §§1–21 (summary)

Foundation **DONE**. Product clinical narrative **DONE** (extensions + `039` drop).
Policy strategy classes **INTENTIONAL_DEVIATION**. DoD §121 posture: see
[DOD-121.md](./DOD-121.md) — **not 100% claimed** (E2E / perf batteries partial).

## §§22–50

| # | Topic | Status | Notes |
|---|-------|--------|-------|
| 22 | Profile templates versioned | **DONE** | Seeds + `037` enrichment |
| 23 | Pharmacy profile | **DONE*** | Caps compose; Insurance engine AVAILABLE |
| 24 | Supermarket | **DONE*** | WEIGHTED etc. may stay EXPERIMENTAL |
| 25 | Restaurant | **DONE*** | Kitchen/Tables engines AVAILABLE; Recipes EXPERIMENTAL |
| 26 | Retail / Boutique | **DONE*** | Variants EXPERIMENTAL |
| 27 | Wholesale | **DONE** | |
| 28 | Inheritance | **INTENTIONAL_DEVIATION** | `base_profile_code` hint |
| 29 | Module ≠ Cap ≠ Feature ≠ Permission | **DONE** | |
| 30–32 | Context / UI / POS | **DONE** | |
| 33 | Product extensions | **DONE*** | Clinical off Product core; hot-path flags remain |
| 34 | VerticalExtensionRegistry | **PARTIAL** | Validates writes; not full plugin host |
| 35–36 | Workflow templates / binding | **DONE*** | |
| 37 | Config validation | **PARTIAL** | |
| 38–44 | Lifecycle / events / outbox / idempotency / cache | **DONE*** | |
| 45–50 | Guards / sales pharmacy example | **DONE*** | Capability gate on confirm |

## Vague 5 — engines & schema

| Item | Status | Notes |
|------|--------|-------|
| Insurance engine (PG) | **DONE** | `vertical-ops` + `038` tables; capability-gated |
| Kitchen / Tables (PG) | **DONE** | KDS tickets + dining tables |
| Hotel PMS (PG) | **DONE** | Rooms, stays, folio; not full commercial PMS |
| Drop clinical columns on `products` | **DONE** | `039` + hydrate on read |
| SurrealDB | **N/A** | Explicitly rejected |
| DoD §121 E2E claim | **PARTIAL** | Checklist in [DOD-121.md](./DOD-121.md) |

## Migrations to apply

Tenant: **032–040**. Control-plane: **053–058**.

## §§51–66

| # | Topic | Status | Notes |
|---|-------|--------|-------|
| 51 | Restaurant example (Order→Kitchen/Recipe/Modifier/Table/Food cost) | **DONE*** | Confirm gates KITCHEN/TABLES when POS requires; auto-fire KDS best-effort; Recipe/Modifier/Food cost still EXPERIMENTAL |
| 52 | Supermarket example (Weighted/Promo/Loyalty/Multi-store) | **DONE*** | WEIGHTED/PROMOTIONS/LOYALTY/MULTI_STORE gated on confirm path |
| 53 | Accounting integration | **DONE** | BC does not spawn a second Accounting; caps only |
| 54 | MCP integration | **DONE*** | Aliases `get_*` / `enable_capability` / `disable_capability` + prior tools |
| 55 | Okapi Copilot readiness | **DONE*** | Context + explain + policy/workflow MCP reads |
| 56 | RAG readiness | **DONE*** | `business_context_documents` + tag filter APIs |
| 57 | Regulatory configuration | **DONE*** | `PUT /business-config/regulatory` (RegulatoryProfile merge → draft if ACTIVE) |
| 58 | Localization | **DONE*** | `PUT /business-config/localization`; identity settings remain parallel SoT |
| 59 | Document configuration | **DONE*** | Profile-scoped template seeds (`040`); common `tenant_document_templates` |
| 60 | Numbering engine | **DONE*** | Extra FAC/CLM/RX/SHP/DN/CN/SUP sequences |
| 61 | Tax configuration | **INTENTIONAL_DEVIATION** | Tax lives in Pricing/Accounting |
| 62 | Profile change migration | **DONE*** | Plan → approve → apply + dry-run |
| 63 | Safe capability disable | **DONE** | INSURANCE blocked on open claims |
| 64 | Soft delete | **DONE*** | `archived_at` / `deprecated_at` columns; rematerialize still replaces capability rows |
| 65 | Immutability (tx stamps) | **DONE*** | `business_context_snapshot` on confirm (`configurationVersion`/`policyVersion`/`businessProfileVersion`) |
| 66 | Audit / forensics | **DONE*** | `authorization_decision` JSON on `sales_orders` at confirm |

### Highest-priority remaining gaps

1. Full Recipe/Modifier/Food-cost / Weighted **engines** (caps gated; runtime still thin).
2. Rematerialize soft-archive of `tenant_capabilities` instead of DELETE.
3. Nest E2E §122 three-vertical simultaneous proof.

## Still deferred / non-goals

- SurrealDB
- Full commercial PMS / EDI insurance clearinghouse
- % feature-flag rollout
- Per-industry InventoryPolicy strategy classes
- Full §122 three-vertical Nest E2E battery + perf/concurrency suites
