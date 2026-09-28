# Insurance — Evidence Audit (Phase 8 Waves 1–3 + hardening)

**Date:** 2026-09-14  
**Verdict:** **PARTIALLY VERIFIED** — Waves 1–3 unit/domain + MCP P4 + recon + Phase 8 audit hardening (fail-closed gate, adapter submit idempotency, MCP eligibility parity, OON, adjudication version).  
**PRODUCTION READY = NO** (no Docker five-tenant insurance HTTP P5 proven).

## Evidence matrix (P0–P5)

| Claim | Evidence | P-level | Status |
|-------|----------|---------|--------|
| Policy / membership / eligibility / claim lifecycle | domain + UC specs (`insurance-domain`, `insurance.use-cases`) | P3 | VERIFIED |
| Authorization / adjudication / appeal / CoB / limits | wave2 domain + `insurance-wave2.spec` | P3 | VERIFIED |
| Reconciliation detectors (7 types) | `reconciliation.engine.ts` + `reconciliation.engine.spec.ts` | P3 | VERIFIED |
| Scan / resolve UCs + events | `insurance-wave3.use-cases.ts` + event-catalog | P3 | VERIFIED |
| Finance payment inbox tryClaim/releaseClaim | `ProcessFinancePaymentReceivedForInsuranceInboxUseCase` + handler | P3 | VERIFIED |
| Org-scoped repo isolation (unit mock) | `insurance-security.spec.ts` | P4 | VERIFIED |
| Forged membership patient mismatch on eligibility | `insurance-security.spec.ts` | P4 | VERIFIED |
| Supermarket / POS-only deny claim create | `insurance-security.spec.ts` + capability gate | P4 | VERIFIED |
| Multi-vertical allow PHARMACY/CLINIC/HOSPITAL/HEALTHCARE_RETAIL | `insurance-multi-vertical.spec.ts` | P4 | VERIFIED |
| Fail-closed capability gate (no business profile → FORBIDDEN) | `insurance-capability-gate.ts` + `insurance-audit-hardening.spec.ts` / `insurance-domain.spec.ts` | P4 | VERIFIED |
| Adapter duplicate submit idempotency (no second adapter call) | `SubmitClaimViaAdapterUseCase` + `insurance-audit-hardening.spec.ts` | P3–P4 | VERIFIED |
| MCP GetMemberEligibility → CheckEligibility (persist + event) | `insurance-wave3.use-cases.ts` + providers | P3 | VERIFIED |
| OON eligibility → REQUIRES_AUTHORIZATION | `eligibility.engine.ts` + domain / audit-hardening specs | P3 | VERIFIED |
| Adjudication uses `inReview.version` as expectedVersion | `AdjudicateClaimUseCase` | P3 | VERIFIED |
| Claim from sales order stores `salesOrderId` | `insurance-claim-from-order.spec.ts` | P3 | VERIFIED |
| COB secondary audited | `@AuditAction('insurance.claim.cob_secondary')` on controller | P3 | VERIFIED |
| Domain ports free of `pg` PoolClient | `InsuranceTxClient` in `domain/ports/tx-client.ts` | P3 | VERIFIED |
| Vertical-ops insurance dual writers removed | prior wave (confirmed absent under `vertical-ops`) | P3 | VERIFIED |
| MCP deny without perm / without cap / allow both | `mcp-tools.insurance-p4.spec.ts` | P4 | VERIFIED |
| Safe-disable open insurance claims | `pg-business-config-runtime-guard.ts` → `insurance_claims` | P3 | VERIFIED |
| Docker five-tenant insurance HTTP P5 | — | P5 | **NOT VERIFIED** |
| Live payer EDI / API submission | stub + manual adapters only | P1 | **NOT VERIFIED** |
| Remittance file / ERA import | — | P2 | **NOT VERIFIED** |
| Performance / failure drills | — | P2 | **NOT VERIFIED** |

## Phase 8 audit fixes (this hardening pass)

| ID | Item | Status |
|----|------|--------|
| INS-H02 | Fail-closed capability gate (`BUSINESS_PROFILE_REQUIRED`) | VERIFIED |
| INS-H03 | `SubmitClaimViaAdapter` idempotent on already-submitted states | VERIFIED |
| INS-H04 | MCP eligibility via `CheckEligibilityUseCase` (rich result + outbox) | VERIFIED |
| INS-M01 | Adjudication version gate uses `inReview.version` | VERIFIED |
| INS-M03 | Network / OON in `evaluateEligibility` | VERIFIED |
| INS-M04 | COB `@AuditAction` | VERIFIED |
| INS-L01 | Domain ports use `InsuranceTxClient` (no `pg` import) | VERIFIED |

## Still NOT VERIFIED

| Item | Status |
|------|--------|
| Docker five-tenant insurance HTTP P5 | NOT VERIFIED |
| Live payer networks / EDI | NOT VERIFIED |
| ERA / remittance batch import | NOT VERIFIED |
| Production Ready | **NO** |

## Migrate

```bash
pnpm migrate:control   # 064
pnpm migrate:tenant <id>  # 051–053
```

## Tests

```bash
pnpm exec vitest run src/modules/insurance src/modules/mcp/application/mcp-tools.insurance src/modules/vertical-ops --reporter=dot
# Result (2026-09-14): 10 files, 62 passed
```

## §63 Final self-audit snippet

| Check | Result |
|-------|--------|
| Plan file untouched | Yes |
| Wave 3 recon + Phase 8 hardening | Yes |
| Inbox finance.payment → insurance wired | Yes |
| MCP tools + P4 + eligibility parity | Yes |
| Docs + CAPABILITY_CATALOG | Yes |
| Production Ready | **NO** until five-tenant Docker P5 |
| Unit tests green (insurance + mcp insurance + vertical-ops) | **10 files / 62 passed** |
