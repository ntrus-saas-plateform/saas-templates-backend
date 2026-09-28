# Insurance Ops (Waves 1–3)

## Migrate

```bash
pnpm migrate:control   # 064 insurance permissions
pnpm migrate:tenant <id>  # 051–053
```

## Capabilities

Enable `INSURANCE` (+ children) on healthcare profiles only — supermarket defaults exclude INSURANCE (see mig `052` / `053` profile updates).

Safe-disable: `PgBusinessConfigRuntimeGuard` counts open `insurance_claims` (not CLOSED/CANCELLED/PAID).

## Reconciliation ops

1. `POST /insurance/reconciliation/scan` — detect remittance gaps
2. Triage `GET /insurance/reconciliation/discrepancies?status=OPEN`
3. `POST .../discrepancies/:id/resolve` with `RESOLVED` / `DISMISSED` / `INVESTIGATING`

Types: `CLAIM_APPROVED_NO_RECEIVABLE`, `PAYMENT_WITHOUT_CLAIM`, `CLAIM_PAID_TWICE`, `PARTIAL_PAYMENT_MISMATCH`, `ADJUDICATION_MISMATCH`, `PAYER_RESPONSE_MISSING`, `PATIENT_RESPONSIBILITY_MISMATCH`

## Finance payment inbox

Ensure Rabbit/outbox delivers `finance.payment.received.v1`. Optional payload `claimId` links remittance to claim; missing claim → `PAYMENT_WITHOUT_CLAIM`.

## MCP

Require `mcp:invoke` + domain permission + BusinessContext caps. Mutations: create/submit claim, request auth, appeal, resolve reconciliation.

## Tests

```bash
pnpm exec vitest run src/modules/insurance src/modules/mcp/application/mcp-tools.insurance --reporter=dot
```
