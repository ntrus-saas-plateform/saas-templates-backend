# Database & migrations audit


**Audit date:** 2026-11-16  
**Backend HEAD:** `25920e0` (`25920e003b747d893ddc5babf104239b45b508de`)  
**Frontend HEAD:** `0994253` (`09942538633042759a9dc848c0db335b1002820d`)  
**Branch:** `feature/console`  
**Method:** Independent adversarial review — source inspection + automated unit/auth tests executed. No application code modified during this audit.  
**Evidence note:** Live PostgreSQL migration apply, live provider E4, and authenticated browser E5 were **not** available in this audit environment unless explicitly stated.


## Present (E2)
- `115_edge_p9_service_catalog.sql`
- `116_edge_p9_operations_core.sql` — extensive CHECK/FK/UNIQUE, version columns on alerts/incidents, alert fingerprint unique

## Executed
- **No** fresh install / upgrade / interrupted migration Testcontainers run in this audit (search `test/` for edge_p9: **0 hits**)

## Findings
- FIND-P9-009 (P1): Gate D incomplete — migrations not E3/E4 qualified in CI/test suite

## Verdict
**FAIL Gate D** until PG qualification exists.
