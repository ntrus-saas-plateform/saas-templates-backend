# Findings register


**Audit date:** 2026-11-16  
**Backend HEAD:** `25920e0` (`25920e003b747d893ddc5babf104239b45b508de`)  
**Frontend HEAD:** `0994253` (`09942538633042759a9dc848c0db335b1002820d`)  
**Branch:** `feature/console`  
**Method:** Independent adversarial review — source inspection + automated unit/auth tests executed. No application code modified during this audit.  
**Evidence note:** Live PostgreSQL migration apply, live provider E4, and authenticated browser E5 were **not** available in this audit environment unless explicitly stated.


## Summary counts
| Severity | Count |
|----------|------:|
| P0 | 0 |
| P1 | 9 |
| P2 | 8 |
| P3 | 3 |

## P1

### FIND-P9-001 — No live health collection pipeline
- **Repo:** BE | **Files:** `operations-policy.ts`, `pg-operations.repository.ts`, mig 116 monitoring_sources
- **SHA:** `25920e0`
- **Impact:** Dashboard cannot prove real availability
- **Repro:** Inspect codebase — no scrape/export adapters; sources stay NOT_CONFIGURED
- **Expected:** Connected providers with failure handling
- **Actual:** Registry + manual/API snapshots only
- **Correction:** Implement authenticated adapters + E4 tests
- **Regression:** Provider up/down + stale telemetry E2E

### FIND-P9-002 — Monitoring provider integrations registry-only
- Same cluster as 001; Gate F fail

### FIND-P9-003 — Major incident crisis orchestration incomplete
- No delivery/ack tracking for responders

### FIND-P9-004 — Releases alias of changes only
- `GET edge/operations/releases` → listChanges

### FIND-P9-005 — On-call without notification delivery
- Rotations persisted; no paging pipeline

### FIND-P9-006 — SLO measurements not proven from telemetry
- Operator/API recorded values possible without source authenticity controls beyond fields

### FIND-P9-007 — DR/backup evidence is opaque string
- VERIFIED needs ref length ≥4 — not provider verification

### FIND-P9-008 — Automation execute is record-only
- Explicit note in `ExecuteAutomationUseCase`

### FIND-P9-009 — Migrations 115/116 lack Testcontainers E3 qualification
- `test/` has no edge_p9 references

## P2
FIND-P9-010 cycle detection; 011 service history; 012 health adversarial; 013 alert storm suite; 014 incident races; 015 structured RCA; 016 deploy provenance; 017 maintenance conflicts; 018 request SLA; 019 task evidence; 020 capacity authenticity; 021 runbook exec security; 022 public status CDN; 023 exception enforcement; 024 live HTTP RBAC; 025 FE depth.

## P3
FIND-P9-026 a11y/UX density; FIND-P9-027 remote push lag documentation; FIND-P9-028 CI wiring undocumented for P9 paths.
