# P2 Completeness Matrix (code-verified — supersedes stale audits)

Status legend: **DONE** | **PARTIAL** | **MISSING** | **OUT_OF_SCOPE**

> Note: An earlier gap audit that claimed research/076/enterprise/pricing-models were schema-only is **outdated**. Current evidence below.

| Lot | Domain | Status | Evidence |
|-----|--------|--------|----------|
| P2.0 | Architecture audit/docs | DONE | `docs/edge/p2/00`–`04` |
| P2.1 | Market intelligence | DONE | markets + assessments + research APIs |
| P2.2 | Segment intelligence | DONE | segment intel + scoring + event |
| P2.3 | ICP | DONE | create/list + segment links + event |
| P2.4 | Personas / committees / journeys | DONE | personas, buying committees, decision journeys |
| P2.5 | Value propositions | DONE | API + quantitative evidence gate |
| P2.6 | Solution packages | DONE | CRUD-ish + capabilities + get-by-id + publish |
| P2.7 | Commercial catalog | DONE | `GET /catalog?view=` projections |
| P2.8 | Plan management | DONE | plans + get-by-id + readiness + publish |
| P2.9 | Enterprise offers | DONE | enterprise templates (076) |
| P2.10 | Add-ons | DONE | create/list/link + **capability mapping** |
| P2.11 | Capability mapping | DONE | package/plan/**addon** commercial inclusions |
| P2.12 | Pricing architecture | DONE | models + flat/per-unit/hybrid/tiered/volume |
| P2.13 | Pricing units / usage metrics | DONE | units + usage metric defs |
| P2.14 | Price books | DONE | books + **GET/POST entries** + publish |
| P2.15 | Discount governance | DONE | policies registry (not CRM requests) |
| P2.16 | Eligibility | DONE | policies persisted + **loaded into configurator** |
| P2.17 | Commercial readiness | DONE | plan + generalized offer evaluate (PACKAGE/ADDON/ENTERPRISE) + hard publish gate |
| P2.18 | Publication | DONE | plan/package/addon/enterprise/price-book snapshots + list |
| P2.19 | Console UI | PARTIAL | hub builders for ICP/package/addon/price entry/enterprise + evaluate/publish actions |
| P2.20 | APIs | DONE | `/api/v1/edge/commercial/**` |
| P2.21 | Migrations | DONE | `075` + `076` (qualification expects 076 last) |
| P2.22 | Events | DONE | market/icp/segment/package/pricebook/offer |
| P2.23 | Security/RBAC | DONE | seeded permissions + server guards |
| P2.24 | Testing | PARTIAL | unit + DB scenarios A–F + CSRF A–F contract; authenticated UI A–F gated on `EDGE_E2E_AUTH` |
| P2.25 | Docs | PARTIAL | numbered set largely present; some condensed |
| P2.26 | Release | PARTIAL | READY_FOR_REVIEW — not staging |

## Still open (honest)
1. Authenticated Playwright UI A–F with Edge Keycloak session fixture (`EDGE_E2E_AUTH=1`)
2. Full multi-page console IA (research builder, capability pickers, approval workflow UI)
3. Discount **request** workflow (P4/P5) — policies only in P2
4. READY_FOR_STAGING blocked until authenticated UI A–F executes in CI
