# Repository and commit baseline


**Audit date:** 2026-11-16  
**Backend HEAD:** `25920e0` (`25920e003b747d893ddc5babf104239b45b508de`)  
**Frontend HEAD:** `0994253` (`09942538633042759a9dc848c0db335b1002820d`)  
**Branch:** `feature/console`  
**Method:** Independent adversarial review — source inspection + automated unit/auth tests executed. No application code modified during this audit.  
**Evidence note:** Live PostgreSQL migration apply, live provider E4, and authenticated browser E5 were **not** available in this audit environment unless explicitly stated.


## Backend — saas-templates-backend

| Field | Value |
|-------|-------|
| Remote | `https://github.com/ntrus-saas-plateform/saas-templates-backend.git` |
| Branch | `feature/console` |
| HEAD | `25920e003b747d893ddc5babf104239b45b508de` |
| Latest subject | `docs(P9): record FE/BE coherence commit SHAs.` |
| vs origin/feature/console | **ahead 2** (`3574b3c`, `25920e0`) — not fully pushed |
| Working tree | clean at audit time |

### P9-relevant commits (local)
- `59eab9a` P9.0/P9.1 catalog foundation
- `23366ad` P9.2–P9.11 operations core
- `3574b3c` FE/BE contract alignment + aliases
- `25920e0` docs SHAs

### Migrations present
- `migrations/control-plane/115_edge_p9_service_catalog.sql`
- `migrations/control-plane/116_edge_p9_operations_core.sql`

## Frontend — saas-template-frontend

| Field | Value |
|-------|-------|
| Remote | `https://github.com/ntrus-saas-plateform/saas-template-frontend.git` |
| Branch | `feature/console` |
| HEAD | `09942538633042759a9dc848c0db335b1002820d` |
| Latest subject | `fix(P9): type unwrapPage list items for Operations Center maps.` |
| vs origin/feature/console | **ahead 17** — substantial unpushed history |
| Working tree | clean at audit time |

### P9-relevant commits
- `d6becd6` P9.1 console catalog
- `6a278b8` ops tabs + API align
- `5bff3a8` API parity + actions
- `0994253` unwrapPage typing fix

## Gate A assessment
**PARTIAL FAIL** for enterprise reproducibility: sources are locally reproducible, but remotes lag (especially FE). Auditor cannot assume remote reviewers see the same SHAs without push.
