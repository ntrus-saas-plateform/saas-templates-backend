# P6 Runbook — Financial Reconciliation

## Daily / weekly

1. Ingest provider mirrors: `POST /edge/billing/provider-transactions`
2. Run: `POST /edge/billing/reconciliation/runs` `{ "provider": "<code>" }`
3. Review: `GET /edge/billing/reconciliation/exceptions?status=OPEN`
4. Resolve with evidence: `POST /edge/billing/reconciliation/exceptions/:id/resolve`
5. Record settlements: `POST /edge/billing/settlements`
6. Export for ERP: `POST /edge/billing/exports` `{ "exportType": "FULL" }`

## Exception types

| Type | Meaning |
|------|---------|
| `MISSING_PROVIDER_TRANSACTION` | Succeeded intent without provider txn |
| `UNMATCHED_PROVIDER_TRANSACTION` | Provider txn without internal intent |
| `MISSING_INTERNAL_TRANSACTION` | Provider points at unknown intent |
| `AMOUNT_MISMATCH` / `CURRENCY_MISMATCH` | Values disagree |

## Do not

- Force-match amount mismatches without finance approval
- Clear exceptions without documenting resolution details in ops notes
