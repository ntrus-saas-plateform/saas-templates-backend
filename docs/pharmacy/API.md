# Pharmacy API (Waves 1–3)

Base: `/api/v1/pharmacy` — `@RequiresCapability('PHARMACY')` (plus child caps per route)

## Wave 1 — prescriptions / dispensing

| Area | Paths | Permission | Extra capability |
|------|-------|------------|------------------|
| Prescribers | `POST/GET /prescribers`, `GET/PATCH /prescribers/:id` | `pharmacy:configure` | `PRESCRIBER_MANAGEMENT` |
| Contraindication rules | `POST/GET /clinical-safety/contraindication-rules` | `pharmacy:configure` | `CLINICAL_SAFETY` |
| Prescriptions | `POST /prescriptions`, list, get, transition, validate | prescription:* | `PRESCRIPTION` (+ `CLINICAL_SAFETY` on validate) |
| Dispensings | prepare / verify / complete / list | dispensing:* | `DISPENSING` / `DISPENSING_VERIFICATION` |
| Clinical override | `POST /clinical-overrides` | `clinical_safety:override` | `CLINICAL_SAFETY` (reason required) |

## Wave 2 — controlled / recall / cold / refill / PV

| Area | Paths | Permission | Capability |
|------|-------|------------|------------|
| Controlled register | record tx / reconcile | `pharmacy:configure` | `CONTROLLED_DRUG_REGISTER` |
| Recall | create / execute / **simulate** | `pharmacy:configure` | `RECALL` / `PATIENT_RECALL` |
| Lot genealogy | `GET /lots/:lotId/genealogy` | `pharmacy:read` | `RECALL` |
| Cold chain | reading / excursion | `pharmacy:configure` | `PHARMACY` |
| Serialization | prepare dispensing `serialNumber` | `dispensing:create` | `SERIALIZATION` (per-line `serialTrackingRequired`) |
| Substitution | record | `prescription:create` | `GENERIC_SUBSTITUTION` / therapeutic |
| Chronic / refill | create / evaluate / complete | prescription:* | `CHRONIC_CARE` / `REFILL_MANAGEMENT` |
| Adverse event / med error | POST | `pharmacy:configure` | `PHARMACOVIGILANCE` / `MEDICATION_ERRORS` |

## Wave 3 — analytics / offline (056) + industrial ops foundation (064)

| Area | Paths | Permission | Capability |
|------|-------|------------|------------|
| KPIs / command-center / offline | `GET /analytics/kpis`, command-center, offline sync | report / configure | `PHARMACY_ANALYTICS` / `PHARMACY_OFFLINE` |
| Batch WO stub | `POST/GET /industrial/batch-orders`, transition | `pharmacy:industrial.*` | `PHARMACY_INDUSTRIAL_OPS` |
| Equipment / PM | `POST/GET /industrial/equipment`, `POST/GET …/maintenance-work-orders` | `pharmacy:industrial.*` | `PHARMACY_INDUSTRIAL_OPS` |
| Stability stub | `POST/GET /industrial/stability-studies`, timepoint result | `pharmacy:industrial.*` | `PHARMACY_INDUSTRIAL_OPS` |
| Quality NC facade | `POST /industrial/quality/non-conformances` | `pharmacy:industrial.manage` | `PHARMACY_INDUSTRIAL_OPS` |
| Ops snapshot | `GET /industrial/ops-snapshot` | `pharmacy:industrial.read` | `PHARMACY_INDUSTRIAL_OPS` |
| Demand live stock | `POST /demand/compute` `syncStock` | `pharmacy:demand.compute` | `PHARMACY_PROCUREMENT` |

**Not claimed:** full MES/eBR, MRP/APS solvers, LIMS instruments, live national hub connectors, ML digital twin.

## Advanced ops (065) — IA lite / IoT / MES depth / serial hub

| Area | Paths | Permission | Capability |
|------|-------|------------|------------|
| Ops copilot (rules) | `GET /ops/copilot` | `pharmacy:ops.copilot` | `PHARMACY_ADVANCED_OPS` |
| Industrial depth status | `GET /ops/industrial-depth` | `pharmacy:ops.copilot` | `PHARMACY_ADVANCED_OPS` |
| Serialization hub config | `POST /regulatory/serialization-hub-config` | `pharmacy:configure` | `PHARMACY_ADVANCED_OPS` |
| Batch components | `POST /industrial/batch-orders/:id/components` | `pharmacy:industrial.manage` | `PHARMACY_ADVANCED_OPS` |
| Signed cold ingest | `POST /cold/ingest` `source=SIGNED_API` | `pharmacy:cold.ingest` | `PHARMACY_ADVANCED_OPS` |
| Demand forecast | `POST /demand/compute` `useForecast` | `pharmacy:demand.compute` | `PHARMACY_PROCUREMENT` |
| Serial↔inventory | prepare/complete with `SERIALIZATION` | dispensing:* | `SERIALIZATION` + `PHARMACY_ADVANCED_OPS` |

## MCP

Reads: `search_drug`, `get_prescription`, `get_dispensing_status`, `check_interactions`, `get_pharmacy_alerts`, `get_refill_due`, `get_recall_status`, `get_pharmacy_metrics`

Mutations: `create_prescription`, `validate_prescription`, `prepare_dispensing`, `verify_dispensing`, `complete_dispensing`, `report_adverse_event`, `report_medication_error`, `create_recall`

Deny-by-default in `mcp-tool-permissions.ts` + `PHARMACY_MCP` + child caps via BusinessContext.
