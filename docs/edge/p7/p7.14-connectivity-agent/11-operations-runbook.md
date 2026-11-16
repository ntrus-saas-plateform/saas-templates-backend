# P7.14 — Operations Runbook

1. Create agent with vault `publicKeyRef` (status PENDING, outbound_only forced).
2. POST `/edge/agents/:id/register` → wait workflow until ACTIVE.
3. Issue commands with a fresh 64-hex nonce each time.
4. On compromise or decommission: POST revoke — confirm active commands → REVOKED and agent REVOKED.
5. Do not reuse `agent_code` after revoke; create a new code.
6. Inspect evidence via `/edge/agents/:id/evidence` and console History tab.
