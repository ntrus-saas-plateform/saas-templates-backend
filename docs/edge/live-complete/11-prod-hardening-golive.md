# 11 — Prod hardening & go-live checklist (Vague 2)

Honest label: **documentation + checklist** — not a claim that production is live.

## Secrets & vault

- [ ] No lab tokens (`lab-token`) in staging/prod
- [ ] `EDGE_BB_CONTROL_TOKEN` / PCI credentials from vault or secret manager
- [ ] `EDGE_BB_CONTROL_ALLOW_INSECURE_HTTP=false` outside lab
- [ ] Rotate Keycloak admin secrets; disable default compose passwords
- [ ] `BILLING_PAYMENT_ADAPTER` never defaults to `sandbox` in prod

## Database & backups

- [ ] Control-plane Postgres automated backups + restore drill documented
- [ ] Tenant DB-per-tenant backup policy owned by BB/ops
- [ ] Migration apply order verified (`122`–`125`+) on a staging clone
- [ ] PITR / RPO-RTO targets written (see SLO below)

## SLO (draft targets — tune with load evidence)

| Surface | Availability | Latency p95 | Notes |
|---------|--------------|-------------|-------|
| Edge API liveness | 99.9% | < 200 ms | probe only |
| Billing confirm / settle | 99.5% | < 2 s | excl. PSP |
| Provision request accept | 99.5% | < 5 s | BB control |
| Revenue overview read | 99.9% | < 500 ms | snapshot read |

Error budget: freeze feature launches when monthly burn > 50% of budget.

## On-call runbooks (minimum)

1. **BB control unreachable** — fail-closed (`DEPENDENCY_UNAVAILABLE`); page BB owners; do not invent READY.
2. **Payment adapter UNAVAILABLE** — check `BILLING_PAYMENT_ADAPTER`; never flip to sandbox in prod to “unblock”.
3. **Cash metrics look wrong** — re-run `POST /edge/revenue/cash/compute`; reject manual COLLECTED/INVOICED without `source=engine`.
4. **Provision stuck NOT_COMPLETE** — poll BB `/ready`; check Keycloak realm + tenant DB health.
5. **Git/push blocked** — Gate A still open until authorized remote sync.

## Go-live gate (sign-off)

| Gate | Owner | Pass? |
|------|-------|-------|
| Pharmacy lab E2E evidence filled | Ops | ☐ |
| Restaurant lab E2E evidence filled | Ops | ☐ |
| Remote Git SHAs synced | Platform | ☐ |
| Secrets vaulted | Security | ☐ |
| Backup restore drill | Ops | ☐ |
| P11 re-audit ≥ READY FOR FINAL RE-AUDIT | Auditor | ☐ |
| Cash engine + provenance gate green in staging | Finance eng | ☐ |

**Do not** self-ACCEPT enterprise production from unit tests alone.
