# 06 — Acceptance criteria V1 (extremely live & complete)

Source: Edge Live Complete Pilot plan — « Critère extremely live & complete (acceptation V1) ».

Status key:

- **CODE_COMPLETE** — implemented in repo / wiring / contracts; machine-checkable without full lab campaign.
- **NEED_LAB_RUN** — requires staging lab execution, evidence SHAs, or remote/Git ops; not claimed by unit green alone.

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Remote Git contient les SHAs lab | **NEED_LAB_RUN** | Local SHAs frozen in [`00-lab-baseline.md`](./00-lab-baseline.md); push historically **403** — remote sync not proven here |
| 2 | Golden path Pharmacy exécuté **sans** adapter `Unavailable*` sur paiement/provision | **NEED_LAB_RUN** | Code path exists (`sandbox` + `lab_bb` + BB control/v1); lab execution + evidence required |
| 3 | BB tenant DB + Keycloak + health prouvés | **NEED_LAB_RUN** | Live executors + readiness gate documented ([`04-keycloak-infra-live.md`](./04-keycloak-infra-live.md)); lab proof pending |
| 4 | Console ops + acquisition publique tous deux OK | **NEED_LAB_RUN** | Surfaces exist; end-to-end console+portal campaign pending |
| 5 | Pack E2E 10 scénarios vert avec correlation IDs | **NEED_LAB_RUN** | Runbook + evidence template ready ([`05-e2e-golden-path.md`](./05-e2e-golden-path.md)); E2/E3 contracts only in CI |
| 6 | Aucun `OPERATION_NOT_IMPLEMENTED` sur le chemin critique provision/activate | **CODE_COMPLETE** | Live product-control executor + control/v1 client wired; missing BB URL fails `DEPENDENCY_UNAVAILABLE` (fail-closed). Lab may use `EDGE_P7_PROVISIONING_ADAPTER=lab_bb` for a complete BB provision path; durable SoD remains `durable` — `lab_bb` ≠ production durable claim |
| 7 | Audit indépendant du **pilotage plateforme** = au minimum `READY FOR FINAL RE-AUDIT` | **NEED_LAB_RUN** | Stub proposal in [`09-pilotage-re-audit-readiness.md`](./09-pilotage-re-audit-readiness.md); auditor + lab evidence still required |

## What is green without claiming live docker E2E

- Docs Phase 0/4/5/6 package under `docs/edge/live-complete/`
- E2/E3 suite: `src/modules/edge/application/live-complete/live-complete-golden-path.spec.ts`
- Opt-in smoke (skipped by default): `test/e2e/live-complete-smoke.e2e-spec.ts`

**Do not** mark criteria 1–5 or 7 PASS from Vitest alone.
