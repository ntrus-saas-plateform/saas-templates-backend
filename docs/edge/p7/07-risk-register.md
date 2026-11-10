# P7.0 — Risk Register

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | Confusing Identity tenants with product tenants | High | ADR-P7-003; distinct tables/APIs |
| R2 | Treating P5 `edge_subscription_provisioning_requests` as full P7 aggregate | High | New P7 request tables; keep 089 as coordination/audit or migrate with dual-write plan |
| R3 | Building UI before durable workflow | High | Gate G0→G1 order; FE after stable contracts |
| R4 | JobScheduler mistaken for saga engine | High | ADR-P7-001 |
| R5 | Activating from P6 unpaid/invoice state | High | Boundary map; P5 only |
| R6 | Assuming Keycloak Organizations available on all versions | Med | Capability registry; declare before Mode B/C |
| R7 | Using vertical KC org as product IAM | High | ADR-P7-002 |
| R8 | Duplicate provisioning from P5 retries | High | Idempotency on authorization id / correlation |
| R9 | Orphan infra if workflow crashes mid-step | High | Leases + fencing + verify-before-retry |
| R10 | Staging P6 still NO-GO blocking full E2E with live billing | Med | P7 SaaS path can use P5 stubs; do not claim full commercial E2E until P6 staging GO |
| R11 | Overclaiming “supported” adapters without certification | Med | Progressive certification rule |
| R12 | Frontend disabled Tenants nav becomes fake CRUD | Med | Build ops console with evidence, not CRUD-only |

## Open decisions needing G0 approval

1. Confirm **in-process durable engine** (ADR-001)
2. Confirm **product IAM topology** separate from vertical KC (ADR-002)
3. Confirm **new P7 schema** vs expanding 089 only (recommend new + link)
4. Confirm **P7 stays in saas-templates-backend** monolith Edge module (recommended)
