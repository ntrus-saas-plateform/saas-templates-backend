# Pharmacy restore drill checklist (§76)

**Status:** PROCEDURE DOCUMENTED — a timed restore with measured RTO is **NOT VERIFIED** until this checklist is executed and signed off.

Follow platform [Disaster Recovery](../DISASTER-RECOVERY.md). Pharmacy tables live in the **tenant** database (migrations `054`–`060`).

## Pre-drill

1. Confirm latest successful tenant backup (timestamp, storage URI).
2. Confirm control-plane backup includes the target tenant + orgs + memberships.
3. Note current pharmacy smoke baseline: `GET /pharmacy/command-center` returns 200 with `PHARMACY` + `PHARMACY_ANALYTICS`.

## Restore order

1. Restore **control-plane** DB (tenant registry, permissions `065`–`066`).
2. Restore **tenant** DB from backup.
3. Run `pnpm migrate:tenant <tenantId>` if backup predates migrations `054`–`060`.
4. Restart API / outbox publisher; do **not** treat Redis as SoT (cache rebuilds).
5. Replay pending outbox (`status = PENDING`); investigate DLQ separately.

## Acceptance checks (post-restore)

Run against the restored tenant DB (replace `:org`):

```sql
-- Core pharmacy
SELECT COUNT(*) FROM pharmacy_prescriptions WHERE organization_id = :org;
SELECT COUNT(*) FROM pharmacy_dispensings WHERE organization_id = :org;
SELECT COUNT(*) FROM pharmacy_locations WHERE organization_id = :org;

-- Enterprise wave4 (059)
SELECT COUNT(*) FROM pharmacy_regulatory_profiles WHERE organization_id = :org;

-- Cross-engine refs still resolve when rows exist
SELECT d.id, d.sales_order_id, d.claim_id
FROM pharmacy_dispensings d
WHERE d.organization_id = :org AND d.status = 'DISPENSED'
LIMIT 20;

-- Saga type allowed after 060
SELECT COUNT(*) FROM orchestration_sagas
WHERE saga_type = 'PHARMACY_DISPENSE' AND organization_id = :org;
```

HTTP smoke:

1. `GET /pharmacy/analytics/kpis`
2. `GET /pharmacy/analytics/reconciliation`
3. `GET /pharmacy/command-center`

## Sign-off fields (fill during drill)

| Field | Value |
|-------|-------|
| Date / operator | |
| Backup timestamp used | |
| Restore start / end (UTC) | |
| Measured RTO | |
| Acceptance SQL OK? | |
| HTTP smoke OK? | |
| Issues / follow-ups | |

Until a row is filled with a real timed run, audit status remains **PARTIALLY VERIFIED**.
