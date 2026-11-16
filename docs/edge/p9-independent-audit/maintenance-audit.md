# Maintenance audit


**Audit date:** 2026-11-16  
**Backend HEAD:** `25920e0` (`25920e003b747d893ddc5babf104239b45b508de`)  
**Frontend HEAD:** `0994253` (`09942538633042759a9dc848c0db335b1002820d`)  
**Branch:** `feature/console`  
**Method:** Independent adversarial review — source inspection + automated unit/auth tests executed. No application code modified during this audit.  
**Evidence note:** Live PostgreSQL migration apply, live provider E4, and authenticated browser E5 were **not** available in this audit environment unless explicitly stated.


## Scope coverage
Windows, conflicts, notification.

## Evidence level
**E2 schedule/list; conflict detection/notification unverified**

## What exists (E2/E3)
- Maintenance windows table with ends_at > starts_at
- Schedule + list APIs + FE form

## What is missing / unverified
- Overlap/conflict detection across deps not evidenced
- TZ/DST suite absent
- Completion evidence optional

## Defects
- FIND-P9-017 (P2): maintenance conflict/notification incomplete

## Sub-verdict
**PARTIAL**
