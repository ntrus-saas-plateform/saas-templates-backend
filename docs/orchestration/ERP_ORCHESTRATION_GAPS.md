# ERP Orchestration Gaps (post 80–124)

## DONE this wave

- Circuit breakers on payment/shipping/accounting adapters
- Named ERP Prometheus metrics + outbox retry/DLQ increments
- Recon dashboard + resolve finding
- Ops: cancel/resume saga, guarded reprocess, repair commands
- ManualInterventionPerformed-shaped event payload
- EventBus abstraction (`OutboxEventBus`)
- Consistency UX enums
- POS/webhook rate limits
- Failure scenario unit matrix
- Integration test matrix doc
- Health includes CRM + Notifications + accounting pending count
- Commercial close / EOD saga starters

## PARTIAL / FUTURE

| Item | Notes |
|------|--------|
| Chaos suites (103) | Not automated |
| Pact contract tests (112) | Unit coverage only |
| Per-step OTEL spans (84) | traceId present |
| Archive purge jobs (99) | Config/docs only |
| Event aggregate ordering (120) | Not enforced in consumer |
| Full PaymentAdapter → CapturePaymentUseCase | Still WAITING façade |

SurrealDB — not planned.
