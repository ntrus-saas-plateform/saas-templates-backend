# Evidence register


**Audit date:** 2026-11-16  
**Backend HEAD:** `25920e0` (`25920e003b747d893ddc5babf104239b45b508de`)  
**Frontend HEAD:** `0994253` (`09942538633042759a9dc848c0db335b1002820d`)  
**Branch:** `feature/console`  
**Method:** Independent adversarial review — source inspection + automated unit/auth tests executed. No application code modified during this audit.  
**Evidence note:** Live PostgreSQL migration apply, live provider E4, and authenticated browser E5 were **not** available in this audit environment unless explicitly stated.


| ID | Claim area | Level | What was done | Limitation |
|----|------------|-------|---------------|------------|
| EV-01 | BE unit/auth tests | E3 | `vitest` platform-operations domain/app/auth — **81 passed** | Not HTTP integration |
| EV-02 | FE module tests | E3 | `vitest` edge-operations-module — **5 passed** | jsdom mocks, not live API |
| EV-03 | Migrations on disk | E2 | Files 115/116 inspected (FK/CHECK/UNIQUE) | Not applied to live PG in this audit (no E4) |
| EV-04 | Health honesty policy | E2+E3 | `assertTrustedHealthSource` + unit test | No live probe ingestion |
| EV-05 | Recovery evidence policy | E2+E3 | `assertRestoreSuccessRequiresEvidence` + unit | Evidence is string ref, not provider proof |
| EV-06 | Change SoD | E2+E3 | `assertSeparationOfDuties` in approve/reject | No HTTP auth matrix beyond Reflect metadata |
| EV-07 | Automation execute | E2 | Records note: provider adapters not wired | No external runtime |
| EV-08 | Monitoring sources | E2 | Table + status enum includes NOT_CONFIGURED | No CONNECTED provider verified |
| EV-09 | Notification delivery | E0/E2-neg | No delivery pipeline under platform-operations | Cannot verify paging |
| EV-10 | FE smoke e2e | E2 | Spec exists (anonymous/CSRF) | Not run in this audit session |
| EV-11 | CI inclusion of P9 | E0/E2-neg | No `.github` match for platform-operations | Pipeline coverage unverified |
| EV-12 | Boundary P5/P6 | E2 | No subscription/billing mutations in P9 use-cases grep | Static only |
