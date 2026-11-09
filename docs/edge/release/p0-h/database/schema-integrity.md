# P0-H.1 — Schema Integrity Report

| Field | Value |
|-------|--------|
| Status | **PASS** (automated negative tests) |
| Suite | `E — integrity and negative tests` in `edge-db-qualification.spec.ts` |

## Results

| Test | Status |
|------|--------|
| Duplicate administrator external identity | PASS (rejected) |
| Duplicate administrator email | PASS (rejected) |
| Duplicate membership (admin, vertical) | PASS (rejected) |
| FK nonexistent vertical | PASS (rejected) |
| Invalid vertical status CHECK | PASS (rejected) |
| Duplicate invitation token_hash | PASS (rejected) |
| Duplicate active role assignment | PASS (rejected) |
| Multi-step TX rollback on unique failure | PASS |
| Vertical roles lack platform create/activate/deactivate seeds | PASS |

## Index / constraint notes

- Redundant indexes exist on some UNIQUE columns (e.g. invitation `token_hash`) — acceptable, non-blocking.
- Active role-assignment uniqueness added in 073 during H.1 (partial unique index).
- Invitation `invited_by` remains without FK by design for bootstrap invites.

## Concurrency

- Uniqueness constraints provide final protection for memberships, invitations, active role assignments.
- Explicit multi-connection race harness: **NOT EXECUTED** in H.1 (covered by constraint semantics + TX rollback test). Marked as follow-up P2 enrichment, not P0/P1.
