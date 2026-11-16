# 27 — Evidence Index

| Field | Value |
|-------|-------|
| **Document** | 27-evidence-index.md |
| **Date** | 2026-11-16 |
| **Branch** | `feature/console` |
| **Backend HEAD reviewed** | `cd064ee677ea6cc069e3a50408f9d84a31de9cb2` |
| **Frontend HEAD reviewed** | `5b83a1bc5ce839925ff5a717103dd33016eb3db9` |
| **Remote backend `feature/console`** | `4fadf08` (local ahead 16; push **403** to `kabikaAsyst`) |
| **Remote frontend `feature/console`** | `d7dcb2e` (local ahead 10; push **403**) |
| **Independent tests executed** | Initial: unit **1093/1093**; security **89/89**. Post-remediation: `tsc` 0; edge **875/875**; security **89/89**; focused **56/56** |
| **Integration / live Keycloak / Testcontainers** | **NOT EXECUTED** → **E4/E5 NOT VERIFIED** |
| **Auditor posture** | Independent, adversarial, evidence-graded (E0–E5) |
| **Program verdict** | **P7 READY FOR FINAL RE-AUDIT** (not ACCEPTED) |


## Commits

| Subject | SHA |
|---------|-----|
| Backend initial audit baseline | `cd064ee677ea6cc069e3a50408f9d84a31de9cb2` |
| Frontend reviewed | `5b83a1bc5ce839925ff5a717103dd33016eb3db9` |
| Remote backend tip | `4fadf08` |
| Remote frontend tip | `d7dcb2e` |
| Remediation commit | *(recorded after local commit; push may 403)* |

## Commands executed (independent)

| # | Command | Environment | Result | Grade |
|---|---------|-------------|--------|-------|
| 1 | `git rev-parse HEAD` (backend) | local `feature/console` | `cd064ee…` (baseline) | E1 |
| 2 | `git rev-parse HEAD` (frontend) | local `feature/console` | `5b83a1b…` | E1 |
| 3 | `npx tsc --noEmit` | backend | 0 errors (baseline + post-fix) | E2 |
| 4 | Unit test suite | backend | **1093/1093** (baseline) | E2 |
| 5 | `npm run test:security` | backend | **89/89** (baseline + post-fix) | E2 |
| 6 | Testcontainers / live Keycloak integration | — | **NOT EXECUTED** (`skipIf`) | — |
| 7 | Static review of live executors & migrations | IDE/repo | Findings AUD-* | E1 |
| 8 | `git push` attempt (context) | GitHub `kabikaAsyst` | **403** | E1 process |
| 9 | `npx vitest run src/modules/edge` | post-remediation | **875/875** | E2 |
| 10 | Focused remediation vitest | post-remediation | **56/56** | E2 |

## Key static evidence paths

| Path | Related findings |
|------|------------------|
| `.../infrastructure-provisioning/live-infrastructure.executor.ts` | AUD-P0-01, AUD-P0-02 |
| `.../product-control/live-product-control.executor.ts` | AUD-P0-02, AUD-P1-02 |
| `.../application/workflow/workflow.use-cases.ts` | AUD-P0-03 |
| `.../configuration-entitlement/*` + DTO/controller | AUD-P0-04 |
| `.../reconciliation|connectivity-agent|production-certification/live-*.executor.ts` | AUD-P0-05 |
| `.../production-certification/certification-policy.ts` + DTO | AUD-P0-06 |
| `.../keycloak/live-keycloak.executor.ts` | AUD-P1-01 |
| `migrations/control-plane/103_*.sql` | AUD-P1-03 |
| `migrations/control-plane/097_*.sql` | AUD-P2-01 |
| `migrations/control-plane/108_*.sql` / `109_*.sql` | AUD-P2-04 |
| `.../local-managed.provider.ts` | AUD-P2-02 |
| `.../credential-provider.adapter.ts` | AUD-P2-03 |
| `.../readiness-activation/live-activation.executor.ts` | AUD-P2-05 |

## Historical evidence (not re-executed)

P7.7 phase docs claim live Keycloak 26.0.7 Testcontainers proofs — graded **E0 for this audit** (not independently reproduced this run).
