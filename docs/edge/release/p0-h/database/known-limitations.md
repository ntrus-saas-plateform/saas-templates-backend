# P0-H.1 — Known Limitations

| Item | Classification | Notes |
|------|----------------|-------|
| Host PostgreSQL 18 `pnpm migrate:control` | **NOT EXECUTED** | Service running; credentials not available non-interactively. Qualification used Testcontainers PG 16 (CI standard). |
| Explicit multi-client race harness | NOT EXECUTED | Uniqueness + TX tests provide DB final-state protection; dedicated race suite deferred (P3). |
| Migration advisory lock / checksums | NOT APPLICABLE / gap documented | Runner has neither; forward-only policy documented. Not introduced in H.1 to avoid framework rewrite. |
| EXPLAIN ANALYZE index proof | NOT EXECUTED | Indexes reviewed against repository query patterns; load EXPLAIN deferred to H.7. |
| Full existing backend suite against upgraded DB | NOT EXECUTED | Upgrade fixture + Edge integrity suite passed; broader ERP integration against upgraded container not re-run in H.1 (H.4 scope). |

None of the above are open **P0/P1** blockers for H.1 given Testcontainers evidence.
