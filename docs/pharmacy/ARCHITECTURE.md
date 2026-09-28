# Pharmacy Architecture — Coverage vs §§1–50

**Verdict:** Enterprise wave4 backend foundation landed; **PRODUCTION READY = NO**.

Bounded context owns prescriptions, dispensing, clinical safety, controlled register, recalls, cold chain, chronic/refill, PV/errors, KPIs, offline ledger, dose/pregnancy dictionaries, patient recall notify, regulatory JSON export, FEFO override, demand suggestions, supplier score extension, medication returns, approvals, adherence, POS session metadata. Does **not** own stock ledger, sales orders, insurance adjudication, catalog master, or a second pricing engine.

## Persistence

| Migration | Scope |
|-----------|--------|
| `054_pharmacy_engine_v1.sql` | Locations, prescribers, Rx, dispensing, clinical safety, interactions |
| `055_pharmacy_wave2.sql` | Controlled / recall / cold / substitution / chronic / PV |
| `063_pharmacy_wave2_traceability.sql` | Dispensing line `serial_number` + lot/serial indexes |
| `064_pharmacy_industrial_ops_foundation.sql` | Batch WO / equipment PM / stability stubs + CAPA effectiveness + `PHARMACY_INDUSTRIAL_OPS` |
| `065_pharmacy_advanced_ops.sql` | Serial↔`stock_serials`, batch components, signed cold `last_seen`/HMAC, serialization hub config slot + `PHARMACY_ADVANCED_OPS` |
| `056_pharmacy_wave3.sql` | KPI + offline ops (analytics — distinct from industrial 064) |
| `057_pharmacy_hardening.sql` | Offline CONFLICT + HTTP idempotency keys |
| `058_pharmacy_architecture_depth.sql` | Prescriber license fields; contraindication rules |
| `059_pharmacy_enterprise_wave4.sql` | Dose/pregnancy dicts, recall notify, cold devices/calibration, expiry snapshots, safety signals/cases, supplier ext, returns, POS sessions, adherence, approvals, regulatory profiles, caps |
| Control-plane `066_pharmacy_enterprise_permissions.sql` | controlled_drug:*, recall:notify, pharmacovigilance:*, pharmacy:approve / fefo.override / return.manage / … |

## Module layout

```
src/modules/pharmacy/
  presentation/pharmacy.controller.ts
  application/pharmacy.use-cases.ts | wave2 | wave3 | wave4
  domain/ (lifecycles, clinical-safety, fefo, demand, adherence, supplier-score, expiration-alert, capability gate, policy)
  infrastructure/ (pg repos wave1–4, providers)
```

## §§1–50 coverage matrix (honest)

| § | Topic | Status | Notes |
|---|--------|--------|-------|
| 1 | Pharmacy configuration / locations | **IMPLEMENTED** | Location CRUD + `parentLocationId` hierarchy + list-by-parent |
| 2 | Policy engine | **IMPLEMENTED** | `PharmacyPolicyBundle` + FEFO override / return quarantine / cold excursion flags |
| 3 | Prescriber management | **IMPLEMENTED** | Create/list/get/update + license gates |
| 4 | Patient profile (CRM extension) | **PARTIAL** | Patient profile JSONB extension — no second patient table; consents UX **MISSING** |
| 5 | Prescription lifecycle | **IMPLEMENTED** | Domain + UCs |
| 6 | Clinical safety core | **IMPLEMENTED** | Allergies / interactions / duplicates |
| 7 | Prescriber license / controlled | **IMPLEMENTED** | |
| 8 | Dispensing + inventory | **PARTIAL** | Complete requires inventory+sales; FEFO allocate + override reason path |
| 9 | Pharmacist verification | **IMPLEMENTED** | Server-derived |
| 10 | Controlled register | **PARTIAL** | Register + recon + destruction + JSON export; full regulatory filing pack **PARTIAL** |
| 11 | Recalls | **IMPLEMENTED** | Create/execute/**simulate** + patient notify + ack + export pack; execute fail-closed on lotId without RecallLot bridge |
| 12 | Cold chain | **PARTIAL** | Readings + devices; excursion with lotId fail-closed quarantine bridge; **SIGNED_API** HMAC ingest + `last_seen` (065) — live vendor IoT SDK **NOT VERIFIED** |
| 13 | Drug dictionary search | **IMPLEMENTED** | |
| 14 | Age / pregnancy / dose | **IMPLEMENTED** | Dictionaries `pharmacy_dose_limit_rules` / `pharmacy_pregnancy_category_rules` wired into Validate |
| 15 | Contraindications | **IMPLEMENTED** | |
| 16 | Adverse events (PV) | **IMPLEMENTED** | IDENTIFIED→ASSESSED→REPORTED→UNDER_REVIEW→CLOSED + Transition UC |
| 17 | Medication errors | **IMPLEMENTED** | Wrong* types + severity/cause/actions/impact + Transition UC |
| 18 | Controlled depth | **PARTIAL** | Tx types already include DESTRUCTION; destruction UC + class on metadata; export uses recon formula |
| 19 | FEFO | **IMPLEMENTED** | `rankLotsByFefo` / SuggestFefoLots + Complete override reason + gate |
| 20 | Expiry alerts | **IMPLEMENTED** | `expiration-alert.engine` + ListPharmacyExpirationAlerts (inventory or snapshot) |
| 21 | Quarantine gate | **IMPLEMENTED** | `assertDispenseLotAllowed` blocks RECALLED/QUARANTINE/EXPIRED |
| 22 | Patient recall notify | **IMPLEMENTED** | `pharmacy_recall_notifications` + Notify/Ack/List UCs (org-scoped) |
| 23–25 | Cold depth | **PARTIAL** | Profiles/devices/calibration; signed API + heartbeat SLA anomalies (`065`); live vendor IoT **NOT VERIFIED** |
| 26 | Procurement demand | **IMPLEMENTED** | Pure demand + live `syncStock` + `useForecast` + PR fail-closed |
| 27 | Supplier pharma extension | **IMPLEMENTED** | `pharmacy_supplier_extensions` + Score UC |
| 28 | Medication returns | **IMPLEMENTED** | Lifecycle + quarantine bridge **required** when policy + lotId |
| 29 | Pricing patient responsibility | **PARTIAL** | Orchestrates optional insurance/pricing ports; stub math if missing — **no second pricing engine** |
| 30–32 | Insurance / Sales / Inventory | **PARTIAL** | Orchestration bridges only (existing) |
| 33–35 | POS | **PARTIAL** | API/DTO/modes + `PharmacyPosSession` + `PHARMACY_POS` gate only — **no full POS rewrite / UI** |
| 36 | Workflows | **IMPLEMENTED** | Catalog expanded with PHARMACY_* templates (§50 set) |
| 37 | Approvals | **IMPLEMENTED** | `pharmacy_approval_requests` + Request/Resolve |
| 38 | Analytics / command center | **PARTIAL** | KPIs exist; adherence delay / open PV / open returns available via wave4 counts (wire enrich cheap) |
| 39 | Adherence | **IMPLEMENTED** | Engine + table + UC + refill.due event |
| 40 | Loyalty | **PARTIAL** | `PHARMACY_LOYALTY` gate only (CRM owns engine) |
| 41 | Notifications | **PARTIAL** | Outbox events: recall.patient_notified / refill.due / prescription.ready |
| 42 | Documents | **MISSING** | No document generation module |
| 43 | Regulatory profiles | **IMPLEMENTED** | Capability + table; serialization hub config slot (`065`) — no country ifs in core |
| 44 | Audit | **PARTIAL** | `@AuditAction` on new POSTs; matrix below |
| 45 | Caps | **IMPLEMENTED** | Seeded in 059 + 065 advanced |
| 46–49 | Serialization / ATC / ingredients / multi-site | **PARTIAL** | Caps + dispense serial gate (`063`) + inventory verify/ISSUED (`065`); national hub **CONFIG_ONLY**; multi-site parentLocationId done |
| 50 | Workflow templates | **IMPLEMENTED** | Catalog + profile bindings |

## Audit matrix (new POSTs)

| Action | Resource | Permission |
|--------|----------|------------|
| dose_limit_rule.upsert | pharmacy_dose_limit_rule | pharmacy:configure |
| pregnancy_rule.upsert | pharmacy_pregnancy_category_rule | pharmacy:configure |
| recall.notify_patients | pharmacy_recall_notification | recall:notify |
| controlled.destroy | pharmacy_controlled_transaction | controlled_drug:destroy |
| return.create / transition | pharmacy_medication_return | pharmacy:return.manage |
| approval.request / resolve | pharmacy_approval_request | pharmacy:approve |
| adherence.record | pharmacy_medication_adherence | pharmacy:adherence.manage |
| pos.session.open | pharmacy_pos_session | pharmacy:configure |
| regulatory_profile.upsert | pharmacy_regulatory_profile | pharmacy:configure |

## Capability gates

`assertPharmacyOperationCapabilities` — BusinessContext only. New flags: `needsPharmacyPos`, `needsPharmacyProcurement`, `needsPharmacySuppliers`, `needsPharmacyApprovals`, `needsPharmacyRegulatory`, `needsMedicationAdherence`, `needsExpirationManagement`, `needsFefoOverride`, …

## Quarantine / dispense lot gate

`assertDispenseLotAllowed` fail-closed: `RECALLED`, `QUARANTINE`/`QUARANTINED`, `EXPIRED`, and any non-`AVAILABLE` quality status blocked; active recall lot numbers blocked via wave2.

## What remains for production

- Live IoT cold-chain adapters (stub ingest VERIFIED)
- Full POS / pricing / insurance UI (§§33–35 PARTIAL — API only, no frontend)
- Document generation (§42 MISSING)
- Full MES/eBR, MRP/APS, LIMS (Wave 3 foundation only — `064`)
- Broader chaos / perf drills beyond mocked outbox

**Docker five-tenant pharmacy HTTP P5 = VERIFIED** (2026-09-14, 12/12, no frontend).

**PRODUCTION READY = NO** (UI/IoT/MES/chaos still open)
