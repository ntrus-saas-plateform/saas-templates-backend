# P6 Certification Report

**Date:** 2026-11-10  
**Programme:** Okapi Edge — Billing & Financial Operations  
**Verdict:** **CODE_COMPLETE / STAGING_NO_GO**

## Summary

P6 Control Plane financial domain is implemented end-to-end in code: accounts, profiles, parties, schedules, invoices (+ PDF artifact), tax registry/packs, payments (pluggable), refunds, credit notes, collections, ledger, reconciliation, settlements, disputes, FX, revenue recognition, accounting export, customer portal, and scheduled jobs (opt-in).

**Staging certification is blocked** until migrations are applied on a live CP database, P0-H gates pass, and a real payment engine is configured (not Hyperswitch).

## Evidence pack

| Artifact | Path / command |
|----------|----------------|
| Migrations | `090`–`094` under `migrations/control-plane/` |
| Unit tests | `npm run test:edge:billing` |
| Migration check | `npm run check:billing:migrations` |
| Certification script | `npm run certify:billing` |
| ADRs | `docs/edge/p6/14-adr-*.md`, `15-adr-*.md` |
| Runbooks | `docs/edge/p6/16-runbook-*.md`, `17-runbook-*.md` |
| API | `EdgeBillingController` `@Controller('edge/billing')` |
| FE | `/edge/billing`, `/edge/billing/portal` |

## Exit criteria (§29) final matrix

| Criterion | Code | Runtime |
|-----------|------|---------|
| Billing accounts / payers / profiles | PASS | PENDING migrate |
| Periods / process-due | PASS | PENDING jobs/migrate |
| Immutable issued invoices + PDF | PASS | PENDING migrate |
| Tax traceability | PASS (packs placeholder) | PENDING counsel |
| Payment orchestration (pluggable) | PASS | PENDING engine |
| Webhooks idempotent | PASS | PENDING secrets |
| Refunds / credits | PASS | PENDING migrate |
| Collections / dunning | PASS | PENDING migrate |
| Events ↔ P5 | PASS (coordination) | PENDING outbox runtime |
| Ledger + recon + settlements | PASS | PENDING migrate |
| Reports billed/collected/recognized | PASS | PENDING migrate |
| Portal + RBAC | PASS | PENDING migrate |
| Adversarial unit tests | PASS | — |
| Staging / recovery verified | FAIL | NO-GO |

## Explicit non-claims

- No live PSP certified
- No Hyperswitch dependency
- No ASC-606 automated deferral
- No live ERP push (export snapshots only)
- Tax rates are operational placeholders requiring counsel
