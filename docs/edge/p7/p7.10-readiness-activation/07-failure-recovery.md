# P7.10 — Failure & Recovery

## Compensation

All P7.10 handlers implement fail-closed compensation:

- Status `WAITING_APPROVAL`
- Instructions: activation must not silently become ACTIVE
- Required permission: `platform:activation:activate`

Never use compensate paths to invent technical ACTIVE or commercial Subscription ACTIVE.

## Evaluate failures

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `AUTHORIZATION_FAILED` / `TRUST_MATERIAL_MISSING` | Missing/stale P7.1 trust material (O3) | Restore production trust keys / refresh provisioning auth; do not bypass |
| Required check FAILED | Prior phase not READY / port missing | Fix P7.5–P7.9 evidence; re-evaluate with new idempotency key |
| Aggregate `NOT_READY` | Blocking codes in evaluation summary | Address listed `blockingCodes`; do not SQL-force READY |
| `PROVIDER_UNAVAILABLE` | Live executor not wired | Wire executor + restart workers |

## Activate failures

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `READINESS_NOT_READY` | Evaluation not READY or unbound | Re-run evaluate until READY; bind evaluation id |
| `EVIDENCE_MISSING` | No readiness evaluation on record | Create/bind evaluation before activate |
| `P5_SIGNAL_FAILED` | Subscription/outbox ports missing with subscription bound | Wire ports; re-activate after fix |
| `ACTIVATION_FORBIDDEN` | Verify saw non-ACTIVE record | Inspect history/runs; do not patch status in SQL |
| Record `FAILED` after auth deny | Trust material / revoke during activate | Fix P7.1; create superseding path if needed |

## Recovery practices

- Prefer **new idempotency keys** for re-evaluate / re-activate after fixing root causes.
- Inspect existing workflow by idempotency key before launching duplicates.
- Treat Activation Record ACTIVE as technical SoT; commercial lifecycle remains separate.
- Do not treat P6 payment success or P1 commercial readiness as substitutes for required technical checks.
- On intentional no-subscription activate, verify evidence shows emit step `SKIPPED` with `NO_SUBSCRIPTION_ID`.

## Supersede / block

Operational supersede/block are recorded via runs/history when used; do not confuse with commercial cancel/revoke. P5 remains entitlement authority.
