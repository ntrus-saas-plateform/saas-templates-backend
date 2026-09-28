# ERP Orchestration — Coverage reqs 40–79

PostgreSQL DB-per-tenant only.

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 40 | ACCOUNTING_PENDING | **Done** | `accounting_posting_pending` + AccountingIntentAdapter |
| 41–42 | Reconciliation engine + states | **Done** | 9 pair types + MATCHED…RESOLVED |
| 43 | Process anomalies | **Done** | `DetectProcessAnomaliesUseCase` + `/monitoring/anomalies` |
| 44 | BusinessProcess | **Done** | Existing `business_processes` |
| 45 | Configurable timeouts | **Done** | Defaults + `orchestration_timeout_config` |
| 46 | Domain state machines | **Done** | Orchestration coordinates, does not bypass |
| 47 | No cross-domain DB mutation | **Done** | Adapters / engines only |
| 48 | Versioned contracts | **Done** | `contractVersion: '1.0'` |
| 49 | Anti-corruption layer | **Done** | `commercial_customer_accounting_map` |
| 50 | Integration adapters | **Done** | Inventory/Accounting/Payment/Warehouse/CRM/Notification/Carrier + PaymentProviders |
| 51–52 | Sync vs async | **Done** | Documented pattern; sync on confirm, async via outbox |
| 53–54 | No 2PC + consistency levels | **Done** | Local TX+outbox+saga; see COMMERCIAL-CONSISTENCY |
| 55–59 | Domain integration flows | **Partial** | Inventory wired; accounting/payment via adapters/intents |
| 60–62 | Returns / refunds / partial | **Done** | Return saga + refund eligibility gate |
| 63–64 | Multi-WH / split shipment | **Partial** | Fulfillment plans exist; planId on shipment optional |
| 65 | Omnichannel OMS | **Done** | POS→same sales engines |
| 66 | Customer 360 | **Partial** | CRM 360 + commercial read models (compose, not merge DB) |
| 67 | Global ERP timeline | **Done** | `erp_timeline_events` + API |
| 68–70 | Audit / tenant / facility | **Partial** | tenantId+correlation+causation; facility via metadata |
| 71–72 | Inter-module / S2S auth | **Partial** | HTTP permissions; Keycloak client_credentials ready |
| 73 | External webhooks | **Done** | commercial-webhooks module |
| 74–76 | PaymentProvider / Accounting / Carrier | **Done** | Ports + stub adapters |
| 77 | Master data sync | **Partial** | Outbound events; inbound stubs FUTURE |
| 78–79 | Integration errors + retry classes | **Done** | `integration-error.ts` taxonomy |

## Migration

`031_orchestration_reqs_40_79.sql`

## APIs

- `POST /orchestration/reconciliation/run`
- `GET /orchestration/reconciliation/findings`
- `GET /orchestration/monitoring/anomalies`
- `GET /orchestration/accounting/pending`
- `POST /orchestration/timeouts`
- `POST /orchestration/acl/customer-accounting`
- `GET|POST /orchestration/timeline`
- `POST /orchestration/refunds/eligibility`
