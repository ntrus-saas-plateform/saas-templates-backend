# 24 — E12 lab / CI exceptions (signed)

**Décision :** Clôturer checklist E12 **beachhead docs + unit evidence** ; items lab/CI restent EXCEPTIONS bloquant go-live client payant.

| Item | Status beachhead | Exception |
|------|------------------|-----------|
| Testcontainers suites critiques | Suites existent ; run lab requis | EX-E12-TC — avant go-live |
| Playwright acquisition/sales/revenue auth | Evidence docs P10 + auth unit specs | EX-E12-PW — subset beachhead documenté |
| Golden path cross-repo CI | Docs golden path ; CI wire reste | EX-E12-CI |
| Push remote reproductible | Local CODE_COMPLETE | EX-P11-003 / EX-E12-PUSH |
| Observability | Doc 22 + signals listés | Wiring alerts prod = ops |
| Rollback plan | Doc 21 | Dry-run ops reste |
| G0–G11 review | Doc 25 gate review | Sign-off go-live séparé |

Go-live client payant = **NO-GO** tant que EX-E12-* ouvertes.
