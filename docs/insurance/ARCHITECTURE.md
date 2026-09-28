# Insurance Architecture — Waves 1–3 (Phase 8)

## Bounded context

**Owns:** Payers, plans, policies, memberships, eligibility requests, prior authorizations, claims (+ lines), submissions, adjudications, denials, appeals, contracts, provider networks, tariffs, limit ledgers, payer receivables (AR intent), claim attachment metadata, reconciliation discrepancies.

**Does not own:** Stock, sales invoices as SoT, general ledger postings, patient clinical chart, live payer EDI networks.

**Finance bridge:** Consumes `finance.payment.received.v1` (inbox) to optionally mark claims `PAID` / `PARTIALLY_PAID` and open remittance discrepancies.

## Persistence

PostgreSQL DB-per-tenant.

- Wave 1: [`051_insurance_engine_v1.sql`](../../migrations/tenant/051_insurance_engine_v1.sql)
- Wave 2: [`052_insurance_wave2.sql`](../../migrations/tenant/052_insurance_wave2.sql)
- Wave 3: [`053_insurance_reconciliation.sql`](../../migrations/tenant/053_insurance_reconciliation.sql)
- Permissions: control-plane [`064_insurance_permissions.sql`](../../migrations/control-plane/064_insurance_permissions.sql)

## Module layout

```
src/modules/insurance/
  presentation/insurance.controller.ts
  application/insurance.use-cases.ts
  application/insurance-wave2.use-cases.ts
  application/insurance-wave3.use-cases.ts
  domain/ (lifecycles, eligibility, adjudication, cob, reconciliation.engine, capability gate)
  infrastructure/ (pg repos, submission adapters, finance payment inbox handler)
```

## Flows

### Claim happy path

```
Eligibility → (optional) Authorization → Claim DRAFT → READY → SUBMITTED
 → Adjudication → APPROVED / PARTIAL / DENIED → Receivable → Payment inbox → PAID
```

### Reconciliation (Wave 3)

```
Scan (claims + receivables + adjudications + submissions)
 → detect* pure functions → persist discrepancies
 → emit insurance.reconciliation.detected.v1
 → resolve/dismiss → insurance.reconciliation.resolved.v1
```

### Inbox

```
finance.payment.received.v1
 → ProcessFinancePaymentReceivedForInsuranceInboxUseCase (tryClaim/releaseClaim)
 → mark claim paid if claimId + valid transition
 → and/or open PAYMENT_WITHOUT_CLAIM / PARTIAL_PAYMENT_MISMATCH / CLAIM_PAID_TWICE
```

Handler wired in `OrchestrationModule` `EXTRA_INTEGRATION_EVENT_HANDLERS` (same pattern as warehouse shipment dispatched).
