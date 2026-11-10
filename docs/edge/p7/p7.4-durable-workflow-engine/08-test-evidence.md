# P7.4 — Test Evidence

## Unit

```bash
npx vitest run src/modules/edge/domain/workflow
npx vitest run src/modules/edge/application/workflow src/modules/edge/presentation/dto/workflow.dto.spec.ts src/modules/edge/presentation/controllers/workflow.controller.auth.spec.ts
```

Coverage focuses on:

- Definition validation (cycles, unknown handlers, expression whitelist)
- Lifecycle transitions
- Retry backoff determinism
- Saga compensation reverse order
- Fencing token rejection
- Handler registry unavailable outcomes
- DTO class-validator
- Controller permission metadata

## Integration (Testcontainers)

`test/integration/edge-workflow-transactional.spec.ts`

| Scenario | Expectation |
|----------|-------------|
| Atomic create | instance + steps + history + audit + outbox |
| Audit failure | full rollback |
| Dual claim | exactly one winner (`SKIP LOCKED`) |
| Stale fencing | `CONFLICT` on complete |
| Compensation order | reverse dependency |
| Human approval | atomic history/audit/outbox |

Requires `TESTCONTAINERS` / `runTestcontainers` helper enabled.
