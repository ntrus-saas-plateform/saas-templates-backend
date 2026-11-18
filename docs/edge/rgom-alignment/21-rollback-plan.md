# 21 — Rollback plan (E12)

## Principes

1. Prefer forward-fix ; rollback = last resort.
2. Never invent MEASURED metrics during rollback.
3. Entitlements : republish last known good Edge snapshot — never empty `{}` in prod.

## Chemins

| Surface | Rollback |
|---------|----------|
| Migration control-plane | Restore DB snapshot pré-migration ; `schema_migrations` aligné |
| Entitlement publish | Re-publish prior publication version ; BB reconcile |
| Billing dunning | Resolve collection → REACTIVATE ; reverse bad suspend via policy |
| Feature flag adapters | `EDGE_P7_PROVISIONING_ADAPTER` / `BILLING_PAYMENT_ADAPTER` → previous non-lab prod value |
| FE console | Redeploy previous frontend artifact ; API version compatible |

## Déclencheurs

- Ready false massif post-publish
- Cash MEASURED sans lignée P6 détecté
- Drift entitlements critique non remédiable < 1h

## Evidence

Journal incident + cash-truth snapshot + drift-scan export.
