# RBAC & security audit


**Audit date:** 2026-11-16  
**Backend HEAD:** `25920e0` (`25920e003b747d893ddc5babf104239b45b508de`)  
**Frontend HEAD:** `0994253` (`09942538633042759a9dc848c0db335b1002820d`)  
**Branch:** `feature/console`  
**Method:** Independent adversarial review — source inspection + automated unit/auth tests executed. No application code modified during this audit.  
**Evidence note:** Live PostgreSQL migration apply, live provider E4, and authenticated browser E5 were **not** available in this audit environment unless explicitly stated.


## Verified (E2/E3)
- Controller methods annotated `@RequireEdgePermissions(...)` — auth matrix spec **executed** (Reflect metadata).
- FE gates tabs/actions via `hasEdgePermission` / `hasAnyEdgePermission` (defense in depth only).
- Edge BFF CSRF rejection covered by smoke **spec** (not re-executed here).
- Change approve SoD in domain.

## Not verified / gaps
- Full role×endpoint HTTP matrix with real tokens (E4)
- IDOR across serviceId scoping
- Attachment/export paths (largely N/A — not implemented)
- SSRF to monitoring endpoints (no outbound adapters found — reduces SSRF surface but also means no integration)
- Rate limiting specific to P9 alert ingest under storm

## Findings
- FIND-P9-024 (P2): authorization proven at decorator metadata level, not live HTTP
- No confirmed P0 authz bypass in static review

## Verdict
**PARTIAL** — design oriented to server auth; Gate E not closed.
