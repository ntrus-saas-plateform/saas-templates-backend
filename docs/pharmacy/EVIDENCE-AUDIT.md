# Pharmacy — Evidence Audit (Waves 1–4 + Enterprise §§1–50)

**Date:** 2026-09-14 · **Wave 1:** 2026-09-15 · **Wave 2:** 2026-09-18 · **Wave 3 industrial:** 2026-09-18 · **Advanced ops 065:** 2026-09-18  
**Verdict Wave 1 (noyau réglementé):** **PRODUCTION READY WITH HARDENING**  
**Verdict Wave 2 (traçabilité):** **PRODUCTION READY WITH HARDENING**  
**Verdict Wave 3 (ops industrielle fondation):** **PRODUCTION READY WITH HARDENING** — batch WO stub, PM calendar, stability protocol stub, CAPA effectiveness, demand↔stock fail-closed. **Not** full MES/MRP/eBR/LIMS.  
**Verdict advanced ops (065):** **PRODUCTION READY WITH HARDENING** — serial↔inventory, batch TRANSFORM, signed cold, rule copilot, hub config-only, demand forecast. **Not** ML twin / live national hub / full MES-eBR-MRP-APS-LIMS.  
**Verdict module global:** **PARTIALLY VERIFIED** — UI / live IoT vendor / chaos remain open.  
**PRODUCTION READY (full pharma ERP) = NO**

## Advanced ops close-out (2026-09-18)

| Claim | Evidence | Status |
|-------|----------|--------|
| Serial verify against `stock_serials` | `assertDispenseSerialAgainstInventory` + Prepare + `stock_serial_id` | **VERIFIED** P3 |
| Complete → serial ISSUED | `updateSerialStatus` on complete when advanced ops | **VERIFIED** P2–P3 |
| Batch RELEASED_LOT → TRANSFORM | `CreateLotLink` + `PARENT_LOT_REQUIRED` / `LOT_LINK_BRIDGE_REQUIRED` | **VERIFIED** P3 |
| Stability FAIL/OOS → NC | Record timepoint + NC bridge fail-closed | **VERIFIED** P3 |
| Signed cold ingest HMAC | `SignedApiTemperatureIngestAdapter` + `POST /cold/ingest` | **VERIFIED** P3 |
| Device heartbeat / stale | `last_seen_at` + copilot `COLD_DEVICE_STALE` | **VERIFIED** P3 |
| Ops copilot rule anomalies | `detectPharmacyOpsAnomalies` + `GET /ops/copilot` | **VERIFIED** P3 |
| Serialization hub config-only | `serialization_hub_config` JSONB + upsert UC | **VERIFIED** P2 |
| Demand `useForecast` | purchasing `DEMAND_FORECAST_PROVIDER` fail-closed | **VERIFIED** P3 |
| Batch components (BOM stub) | `pharmacy_batch_order_components` | **VERIFIED** P2 |
| Full MES / MRP / APS / eBR / LIMS / ML twin / live national hub | — | **NOT IN SCOPE** |

## Wave 3 close-out (2026-09-18)

| Claim | Evidence | Status |
|-------|----------|--------|
| Demand live stock sync | `ComputePharmacyDemand` `syncStock` + `STOCK_BRIDGE_REQUIRED` | **VERIFIED** P3 |
| Demand→PR fail-closed | `REQUISITION_BRIDGE_REQUIRED` | **VERIFIED** P3 |
| CAPA effectiveness + NC close gate | mig `064` + `VerifyCapaEffectiveness` + `CAPA_EFFECTIVENESS_REQUIRED` | **VERIFIED** P2–P3 |
| Batch / equipment / stability stubs | `pharmacy-industrial.*` + mig `064` | **VERIFIED** P3 |
| Command-center industrial enrich | GetPharmacyCommandCenter + industrial snap when cap on | **VERIFIED** P3 |
| List GET industrial resources | equipment / maintenance / stability list UCs + routes | **VERIFIED** P2 |
| Events catalog | batch/maintenance/stability registered | **VERIFIED** P1 |
| Full MES / MRP / APS / eBR / LIMS | — | **NOT IN SCOPE** |

## Wave 2 close-out (2026-09-18)

| Claim | Evidence | Status |
|-------|----------|--------|
| Simulate recall (dry-run) | `SimulateRecallUseCase` + wave2 spec | **VERIFIED** P3 |
| Lot genealogy facade | `GetPharmacyLotGenealogyUseCase` → inventory GetGenealogy | **VERIFIED** P3 |
| Serial at prepare | mig `063` + `assertDispenseSerials` + prepare UC | **VERIFIED** P2–P3 |
| ExecuteRecall fail-closed without bridge | `RECALL_BRIDGE_REQUIRED` | **VERIFIED** P3 |
| Cold / return quarantine fail-closed | `QUARANTINE_BRIDGE_REQUIRED` | **VERIFIED** P3 |
| National serialization / eBR / LIMS | — | **NOT IN SCOPE** |

## Wave 1 close-out (2026-09-15)

| Claim | Evidence | Status |
|-------|----------|--------|
| GRN → quarantine (dated lots) | `ReceiveGoodsUseCase` `holdForQc` + `purchasing-pharma-receive.spec` | **VERIFIED** P3 |
| Quarantine blocks dispense | `assertDispenseLotAllowed` + wave1 supply-chain spec | **VERIFIED** P3 |
| Demand → purchase requisition | `ComputePharmacyDemandUseCase` + `CreatePurchaseRequisitionUseCase` wired | **VERIFIED** P3 |
| Idempotency prepare/verify/cancel | mig `062` + UC + controller headers | **VERIFIED** P2–P3 |
| QC release RBAC for manager/org-admin | CP `068` `inventory:quality`/`quarantine` | **VERIFIED** P1 |
| Dispense → SO → AR event contract | `pharmacy-wave1-finance-trace.spec` | **PARTIALLY VERIFIED** P3 mocked |

## Evidence matrix (P0–P5)

| Claim | Evidence | P-level | Status |
|-------|----------|---------|--------|
| Prescription / dispensing / clinical safety lifecycle | domain + UC specs | P3 | VERIFIED |
| Controlled / recall / cold / refill / PV | wave2 + specs | P3 | VERIFIED |
| KPI / command-center | wave3 | P3 | VERIFIED |
| Offline sync + Idempotency-Key | offline-idempotency + helpers | P3–P4 | PARTIALLY VERIFIED |
| Org-scoped privacy | pharmacy-security / privacy specs | P4 | VERIFIED |
| Five-tenant capability matrix (unit) | pharmacy-five-tenant-p5.spec | P4–P5 | VERIFIED (unit) |
| Dose / pregnancy dictionaries | `pharmacy-wave4.spec` + clinical-safety.engine | P3 | VERIFIED |
| PV adverse event transition | lifecycle + TransitionAdverseEventUseCase | P3 | VERIFIED |
| FEFO rank + override reason | fefo-lot-rank + wave4 spec | P3 | VERIFIED |
| Demand / adherence / supplier score | pure domain specs | P3 | VERIFIED |
| Medication return quarantine | lifecycle + return UC fail-closed bridge | P3 | VERIFIED |
| Recall simulate + genealogy | SimulateRecall + GetPharmacyLotGenealogy | P3 | VERIFIED |
| Serial dispense gate | dispense-serial-gate + mig 063 | P3 | VERIFIED |
| Patient recall notify | NotifyRecallPatientsUseCase + outbox event | P3 | PARTIALLY VERIFIED (unit; no live SMS/WA) |
| Cold IoT adapters | Manual/Csv/Api/IotStub | P2 | PARTIAL (stub only) |
| Regulatory JSON export | ExportControlledRegister / ExportRecallPack | P3 | PARTIALLY VERIFIED |
| §§33–35 POS | API/DTO/modes + session metadata | P2 | **PARTIAL** (no UI) |
| Docker five-tenant pharmacy HTTP P5 | `multi-vertical-five-tenant.e2e-spec.ts` | P5 | **VERIFIED** (2026-09-14 — 12/12 TESTCONTAINERS) |
| Performance / failure drills | — | P2 | **NOT VERIFIED** |

## Still open for Production Ready

| Item | Status |
|------|--------|
| Live IoT cold-chain | NOT VERIFIED |
| UI §§33–35 / documents §42 | PARTIAL / MISSING |
| Chaos / perf drills | NOT VERIFIED |
| **Production Ready** | **NO** |

## Migrate

```bash
pnpm migrate:control   # 065–066 + 068 QC + **069** industrial perms
pnpm migrate:tenant <id>  # 054–060 + 062 + 063 + **064** industrial ops foundation
```

## Tests

```bash
pnpm exec vitest run src/modules/pharmacy src/modules/mcp/application/mcp-tools.pharmacy --reporter=dot
# P5 (Docker, no frontend):
TESTCONTAINERS=true pnpm exec vitest run --config ./vitest.config.e2e.ts test/e2e/multi-vertical-five-tenant.e2e-spec.ts
```

## § Final self-audit

| Check | Result |
|-------|--------|
| §§1–50 matrix honest | Yes — ARCHITECTURE.md |
| Unit/MCP | **133 passed** |
| Docker P5 pharmacy HTTP | **VERIFIED 12/12** |
| Production Ready | **NO** |
| UI §§33–35 | **PARTIAL** (API only) |
