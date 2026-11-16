# P7.15 — Operations Runbook

1. Create DRAFT package (`POST /edge/certification/packages`).
2. Assemble (`…/assemble`) to seed required keys (+ optional p714_agents).
3. Attach/verify each required evidence item until none are MISSING/FAILED.
4. Re-assemble if needed until package `READY`.
5. Certify (`…/certify`) — fails closed if gates block.
6. To withdraw: Revoke (`…/revoke`) — clears CERTIFIED.
7. Console: `/edge/provisioning/certification` and Evidence viewer `/edge/provisioning/evidence`.
