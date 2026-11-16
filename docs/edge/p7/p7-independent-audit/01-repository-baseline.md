# 01 — Repository Baseline

| Field | Value |
|-------|-------|
| **Document** | 01-repository-baseline.md |
| **Date** | 2026-11-16 |
| **Branch** | `feature/console` |
| **Backend HEAD reviewed** | `cd064ee677ea6cc069e3a50408f9d84a31de9cb2` |
| **Frontend HEAD reviewed** | `5b83a1bc5ce839925ff5a717103dd33016eb3db9` |
| **Remote backend `feature/console`** | `4fadf08` (local ahead 16; push **403** to `kabikaAsyst`) |
| **Remote frontend `feature/console`** | `d7dcb2e` (local ahead 10; push **403**) |
| **Independent tests executed** | `tsc` 0 errors; unit **1093/1093**; security **89/89** |
| **Integration / live Keycloak / Testcontainers** | **NOT EXECUTED** this audit run (`skipIf` without containers) → **E4/E5 NOT VERIFIED** |
| **Auditor posture** | Independent, adversarial, evidence-graded (E0–E5) |


## Repositories

| Repo | Local path | Branch | HEAD reviewed |
|------|------------|--------|---------------|
| Backend | `saas-templates-backend` | `feature/console` | `cd064ee677ea6cc069e3a50408f9d84a31de9cb2` |
| Frontend | `saas-template-frontend` | `feature/console` | `5b83a1bc5ce839925ff5a717103dd33016eb3db9` |

## Remote divergence

| Remote tip | Relation to local | Push |
|------------|-------------------|------|
| Backend `origin/feature/console` ≈ `4fadf08` | Local **ahead 16** | **HTTP 403** (`Permission denied` to `kabikaAsyst`) |
| Frontend `origin/feature/console` ≈ `d7dcb2e` | Local **ahead 10** | **HTTP 403** |

**Implication:** Reviewed code is **not** confirmed published to the shared remote. Audit baseline is local HEAD only. Do not claim remote certification of this SHA.

## Independent test execution (this run)

| Suite | Command (repr.) | Result | Evidence |
|-------|-----------------|--------|----------|
| Typecheck | `npx tsc --noEmit` | **0 errors** | E2 |
| Unit | `npm test` / vitest unit | **1093 / 1093** | E2 |
| Security | `npm run test:security` | **89 / 89** | E2 |
| Integration / Keycloak live | Testcontainers vitest | **NOT EXECUTED** (`skipIf` without containers) | E4/E5 **NOT VERIFIED** |

## Migration inventory (control-plane, P7-relevant)

| # | File | Phase |
|---|------|-------|
| 095–102 | `095`…`102_edge_p7_*.sql` | P7.1–P7.7 |
| 103 | `103_edge_p7_configuration_entitlement_deployment.sql` | P7.8 |
| 104 | `104_edge_p7_product_experience_provisioning.sql` | P7.9 |
| 105 | `105_edge_p7_readiness_activation.sql` | P7.10 |
| 106 | `106_edge_p7_tenant_lifecycle.sql` | P7.11 |
| 107 | `107_edge_p7_onboarding_operations.sql` | P7.12 |
| **108** | `108_edge_p8_advanced_tenant_management.sql` | **P8 intercalated** (AUD-P2-04) |
| 109 | `109_edge_p7_reconciliation_operational_governance.sql` | P7.13 |
| 110 | `110_edge_p7_connectivity_agent.sql` | P7.14 |
| 111 | `111_edge_p7_production_certification.sql` | P7.15 |
| 112 | `112_edge_p8_audit_remediation.sql` | P8 (out of P7 acceptance scope; noted for chain hygiene) |

## Baseline verdict

**BASELINE ESTABLISHED WITH LIMITS** — local SHAs recorded; remote unpublished; live integration suites not run this audit.
