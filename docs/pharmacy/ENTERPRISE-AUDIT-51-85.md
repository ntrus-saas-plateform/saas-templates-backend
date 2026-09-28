# Pharmacy Enterprise Audit §§51–85

**Date:** 2026-09-14 · **Wave 1:** 2026-09-15 · **Wave 2–3:** 2026-09-18  
**Verdict (module global):** **NOT PRODUCTION READY** for full ERP / Wave 4 IA / UI / IoT / chaos / MES.  
**Verdict Wave 1–2:** **PRODUCTION READY WITH HARDENING**  
**Verdict Wave 3 industrial foundation:** **PRODUCTION READY WITH HARDENING** (batch/PM/stability CRUD+lists, CAPA effectiveness, demand↔stock, command-center enrich, events, RBAC) — **not** full MES/MRP/eBR.  
**Unit evidence:** pharmacy suite **202** green (incl. industrial + command-center enrich + event catalog).

## Wave 3 remediations (2026-09-18)

| Gap | Fix |
|-----|-----|
| Demand without live stock | `syncStock` → inventory `checkAvailability`; fail-closed |
| CAPA theater | effectiveness columns + verify UC; NC CLOSE gated |
| No industrial ledger | `064` batch / equipment / maintenance / stability stubs |
| Naming collision 056 vs industrial | Docs: analytics `056` ≠ industrial `064` |

## Wave 2 remediations (2026-09-18)

| Gap | Fix |
|-----|-----|
| No recall dry-run | `SimulateRecallUseCase` + `POST /recalls/:id/simulate` |
| Genealogy pharmacy-side | `GetPharmacyLotGenealogyUseCase` → inventory GetGenealogy |
| Serial at dispense | mig `063` + `assertDispenseSerials` on prepare |
| ExecuteRecall optional bridge | Fail-closed `RECALL_BRIDGE_REQUIRED` when lotId set |
| Cold/return optional quarantine | Fail-closed `QUARANTINE_BRIDGE_REQUIRED` when policy + lotId |

## Wave 1 remediations (2026-09-15)

| Gap | Fix |
|-----|-----|
| GRN never `holdForQc` | `ReceiveGoodsUseCase` + DTO; dated lots default quarantine |
| Demand→PR unwired | `CreatePurchaseRequisitionUseCase` injected into `ComputePharmacyDemandUseCase` |
| Idempotency 3 ops only | Tenant `062` + prepare/verify/cancel |
| Manager lacks `inventory:quality` | CP `068` |
| Audit before prepare/verify | `setAuditBefore` on prepare/verify/cancel routes |

## Status matrix (§83 no-evidence rule)

| § | Topic | STATUS | Notes |
|---|--------|--------|-------|
| 51 | Audit trail red team | PARTIALLY VERIFIED | `@AuditAction` + `setAuditBefore` / mutation hints for `before` (no longer always null). Interceptor metadata. **No** delete/bypass red-team suite. Audit on **control-plane**; tenant outbox is separate DB — same SQL TX **architecturally N/A**; linked via `correlationId` (`auditOutboxSameTx: false`). |
| 52 | Audit ↔ event | PARTIALLY VERIFIED | Core + cancel + wave4 returns/signals/POS/approvals/regulatory outbox events |
| 53 | Database audit | PARTIALLY VERIFIED | Migrations 054–059 org indexes/uniques/version. No EXPLAIN / race suite. |
| 54 | API security matrix | PARTIALLY VERIFIED | Permissions + capabilities; **`@RequireModule('pharmacy')`**. Idempotency on create/validate/**prepare/verify/cancel**/complete (`062`). |
| 55 | API fuzzing | PARTIALLY VERIFIED | Domain fuzz + **wave4 HTTP DTOs** (class-validator Min/Max); full HTTP fuzz harness still open |
| 56 | Input validation | PARTIALLY VERIFIED | Domain validators + wave4 DTO bounds |
| 57 | JWT / auth | PARTIALLY VERIFIED | Platform JWT: issuer/aud/exp/clockTolerance(60s)/missing tenant; pharmacy CapabilityGuard PHARMACY fail-closed (`pharmacy-resilience.spec` + jwt-validation.spec) |
| 58 | Role escalation | PARTIALLY VERIFIED | `pharmacy-access.ts` role catalog + escalation specs |
| 59 | Feature flags | PARTIALLY VERIFIED | Cap ON + perm OFF → DENIED |
| 60 | Business profiles | PARTIALLY VERIFIED | Unit multi-vertical matrix. |
| 61 | Five-tenant | PARTIALLY VERIFIED | Unit + Docker e2e claimed historically; **not re-run this session**. |
| 62 | Multi-pharmacy same org | PARTIALLY VERIFIED | Scope + membership `resourceScopes` ∩ policy |
| 63 | Anti-giant-conditional | PARTIALLY VERIFIED | Pharmacy module: capability gates, no `businessType` ifs. |
| 64 | Extensibility | PARTIALLY VERIFIED | Caps/policy/workflow pattern; no NEW HOTEL/DELIVERY proof. |
| 65 | Domain purity | PARTIALLY VERIFIED | Domain free of Nest/Redis/Surreal; policy types import business-config. |
| 66 | Cache security | PARTIALLY VERIFIED | Key isolation + Redis fail-open get→null (`pharmacy-resilience.spec`) |
| 67 | Cache failure | PARTIALLY VERIFIED | Redis down: get null / set+invalidate swallow (DB SoT) — unit only |
| 68 | DB failure | PARTIALLY VERIFIED | Outbox rollback units |
| 69 | Broker failure | PARTIALLY VERIFIED | Outbox throw → no create row (Rx + medication return) |
| 70 | External provider | PARTIALLY VERIFIED | Bridge timeout + fail-closed; dispense compensation LIFO: **claim cancel** + sales cancel + inventory return/release. Live payer/IoT chaos **NOT VERIFIED**. |
| 71 | Observability | PARTIALLY VERIFIED | correlationId on events; no pharmacy dashboards proof. |
| 72 | KPIs | PARTIALLY VERIFIED | KPI UC + gate; no raw-vs-dashboard reconcile. |
| 73 | Performance | PARTIALLY VERIFIED | Micro stub only (`pharmacy-chaos-perf.stub.spec` — 2k recon lines). No soak / p95 SLOs. |
| 74 | Load | PARTIALLY VERIFIED | Micro stub only (500 recon checks). No k6/load harness. |
| 75 | Chaos | PARTIALLY VERIFIED | Injected bridge failure fail-closed unit. No broker/DB/Redis kill drill. |
| 76 | Backup / restore | PARTIALLY VERIFIED | Ops order + [RESTORE-DRILL.md](./RESTORE-DRILL.md) checklist (054–060). **No** signed timed RTO evidence. |
| 77 | Migration | PARTIALLY VERIFIED | SQL 054–060 present; no formal before/after validation script. |
| 78 | Regression | PARTIALLY VERIFIED | Pharmacy suite green; full ERP battery not run this session. |
| 79 | Integration consistency | PARTIALLY VERIFIED | Complete dispense bridges + compensation + saga; **Wave 1**: GRN→quarantine→dispense gate + demand→PR + AR event contract (mocked). Full Accounting E2E **NOT VERIFIED**. |
| 80 | Reconciliation | PARTIALLY VERIFIED | Pure detectors + `RunPharmacyReconciliationUseCase` + `GET /pharmacy/analytics/reconciliation`; controlled physical via existing reconcile UC. Full financial/Accounting recon **NOT VERIFIED**. |
| 81–85 | Process | N/A / applied | Classification + no-evidence + FP/FN controls applied in this audit. |

## Remediations applied this pass

1. `@RequireModule('pharmacy')` on `PharmacyController`
2. Audit interceptor: `params.id` (+ pharmacy params), `metadata.reason`, `metadata.pharmacyLocationId`, `metadata.source`
3. `@AuditAction` on Rx get/list, dispensing list, affected patients, controlled/recall export, patient-responsibility
4. `CancelDispensingUseCase` + `POST /pharmacy/dispensings/:id/cancel` + event `pharmacy.dispensing.cancelled.v1`
5. **§58** `pharmacy-access.ts` role catalog + defense-in-depth `assertPharmacyPermissions` on override/cancel/destroy/returns/approvals
6. **§62** `assertPharmacyLocationInScope` + filter on list/get Rx/dispense/locations; policy `allowedLocationIds`
7. **Wave4 events:** safety_signal, medication_return, pos.session, approval, regulatory_profile
8. **Membership→scope:** `PharmacyLocationScopeResolver` reads `resourceScopes` (`pharmacy_location`) ∩ policy
9. **§55/§56:** `pharmacy-input-validation.ts` + fuzz specs; wired into Rx create, cold, pricing, dose, destruction
10. **§59:** capability ON + permission OFF denied at UC permission gate
11. **§57:** JWT clockTolerance 60s + expired/iss/aud tests; pharmacy CapabilityGuard PHARMACY fail-closed
12. **Wave4 DTOs:** class-validator on dose/pregnancy/calibration/signal/demand/supplier/return/pricing/approval/adherence/regulatory/destruction
13. **§66–69:** Redis BC cache fail-open + outbox failure no silent create (`pharmacy-resilience.spec.ts`)
14. **§70:** `pharmacy-external-bridge.ts` + wired CompleteDispense / patient responsibility / API cold ingest; fail-closed unit specs
15. **§80:** `pharmacy-reconciliation.engine.ts` + `GET /pharmacy/analytics/reconciliation`
16. **§76:** Pharmacy backup/restore order in `OPS.md` (pointing at platform DR)
17. **§70/§79:** best-effort `compensatePharmacyDispenseSideEffects` after inventory/sales/claim external commits (cancel claim + SO + stock return / release)
18. **§73–§75:** micro perf + injected-failure stubs only (not load/chaos VERIFIED)
19. **§80:** `membershipId` persisted on dispensing metadata at complete for claim-linkage recon
20. **§79:** `PHARMACY_DISPENSE` saga type (migration `060`) + `PharmacyDispenseSagaOrchestrator` wired into CompleteDispense
21. **§76:** [RESTORE-DRILL.md](./RESTORE-DRILL.md) acceptance checklist (timed run still open)
22. **§51:** `setAuditBefore` + interceptor `before` (entity snapshot or mutation hint); same-TX audit↔outbox documented as N/A (control-plane vs tenant)

## Honest gaps (do not claim VERIFIED)

- Dedicated red-team for audit delete/bypass, JWT attacks, role escalation, fuzz
- Multi-location IDOR, Redis/DB/broker kill drills, k6/load, **signed** timed backup restore drill, full financial reconciliation
- Live IoT cold-chain
- Cross-DB audit↔outbox single SQL transaction (control-plane vs tenant) — correlationId linkage only
- Wave4 missing domain events for several mutations

**PRODUCTION READY = NO**
