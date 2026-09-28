# Pharmacy Events (Waves 1–3)

Registered in `event-catalog.ts`. Mutations use transactional outbox + `commercialEvent`.

| Event | When |
|-------|------|
| `pharmacy.prescription.created.v1` | Prescription created |
| `pharmacy.prescription.status_changed.v1` | Prescription status transition |
| `pharmacy.prescription.validated.v1` | Validation passed |
| `pharmacy.prescription.validation_failed.v1` | Validation rejected |
| `pharmacy.clinical_safety.checked.v1` | Clinical safety evaluation stored |
| `pharmacy.clinical_safety.overridden.v1` | Override with mandatory reason |
| `pharmacy.dispensing.prepared.v1` | Dispensing prepared |
| `pharmacy.dispensing.verified.v1` | Pharmacist verified |
| `pharmacy.dispensing.dispensed.v1` | Dispensing completed |
| `pharmacy.controlled.transaction_recorded.v1` | Controlled register tx |
| `pharmacy.controlled.recon_discrepancy.v1` | Controlled recon variance |
| `pharmacy.recall.created.v1` | Recall notice created |
| `pharmacy.recall.executed.v1` | Recall executed; affected linked |
| `pharmacy.cold.reading_recorded.v1` | Cold reading |
| `pharmacy.cold.excursion_opened.v1` | Excursion opened |
| `pharmacy.substitution.recorded.v1` | Substitution decision |
| `pharmacy.chronic.treatment_created.v1` | Chronic treatment |
| `pharmacy.refill.completed.v1` | Refill schedule completed |
| `pharmacy.adverse_event.reported.v1` | Adverse event |
| `pharmacy.medication_error.reported.v1` | Medication error |
| `pharmacy.offline.operation_synced.v1` | Offline op applied (analytics Wave 3 / `056`) |
| `pharmacy.batch_order.created.v1` | Industrial batch WO created (`064`) |
| `pharmacy.batch_order.transitioned.v1` | Industrial batch WO status changed |
| `pharmacy.maintenance_wo.created.v1` | Equipment PM work order created |
| `pharmacy.stability_study.created.v1` | Stability protocol stub created |
