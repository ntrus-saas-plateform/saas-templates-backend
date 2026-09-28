# ERP Orchestration — Coverage reqs 80–124

| # | Status | Notes |
|---|--------|-------|
| 80 | **Done** | CircuitBreaker on Payment/Shipping/Accounting adapters |
| 81 | **Done** | Throttle on POS offline sync + webhook dispatch (+ global throttler) |
| 82 | **Done** | `buildStructuredOpLog` helper (tenant/correlation/causation/event/aggregate/op/duration/status) |
| 83 | **Done** | Prometheus counters: orders_*, reservations_failed, payments_failed, inventory_postings_failed, accounting_postings_pending, saga_failures, event_retries, dead_letter_events, reconciliation_mismatches |
| 84 | **Partial** | traceId on events + OTEL; span-per-step FUTURE |
| 85 | **Done** | `GET /orchestration/reconciliation/dashboard` |
| 86 | **Done** | cancel/resume/replay/compensate/resolve + audited interventions |
| 87 | **Done** | ManualInterventionPerformed-shaped payload on `orchestration.manual_intervention.v1` |
| 88 | **Done** | Guarded `POST /orchestration/ops/reprocess` |
| 89 | **Done** | `POST /orchestration/ops/repair` Correction/Adjustment/Reversal/Compensation |
| 90–93 | **Partial** | Recon pairs + three-way; collectors best-effort |
| 94–96 | **Done** | Commercial close + EOD saga start; POS shift close EXISTS |
| 97 | **Partial** | Projections/docs; not all event-driven |
| 98 | **Done** | Event envelope metadata |
| 99–100 | **Partial** | Retention/DR docs |
| 101 | **Done** | Unit failure-scenario matrix |
| 102–103 | **Partial** | Load/idempotency exists; chaos FUTURE |
| 104 | **Partial** | In-process gateway concerns |
| 105–106 | **Done** | Adapters + `EventBus` / `OutboxEventBus` |
| 107 | **Done** | Outbox at-least-once + inbox |
| 108–110 | **Done** | Saga docs + timeline |
| 111 | **Done** | `ERP_INTEGRATION_TEST_MATRIX.md` |
| 112 | **Partial** | Domain unit/contract-style specs; Pact FUTURE |
| 113 | **Done** | Contract versioning policy in docs |
| 114–116 | **Partial** | Outbox anti-dual-write documented |
| 117 | **Done** | Tenant mismatch consumer tests |
| 118–120 | **Partial** | Perf docs / no hard ordering yet |
| 121 | **Done** | Consistency UX enums |
| 122–124 | **Done** | business-processes/:id, integrations/health (+CRM/Notifications), admin ops APIs |

## Key APIs added

- `GET /orchestration/reconciliation/dashboard`
- `POST /orchestration/sagas/:id/cancel|resume`
- `POST /orchestration/reconciliation/findings/:id/resolve`
- `POST /orchestration/ops/reprocess`
- `POST /orchestration/ops/repair`
- `POST /orchestration/close/end-of-day`
- `POST /orchestration/close/commercial`
