# P7.14 — Domain Model

## Aggregates

- **ConnectivityAgent** — identity, vault `publicKeyRef`, `outboundOnly`, status lifecycle PENDING→REGISTERING→ACTIVE→REVOKING→REVOKED.
- **AgentCommand** — typed allowlisted command, unique `(agentId, nonce)`, signature/payload vault refs.
- **AgentSpool** — outbound delivery queue for disconnected agents.
- **AgentEvidence / History** — durable audit of workflow steps and status transitions.

## Status machines

Agent: `PENDING | REGISTERING | ACTIVE | DEGRADED | REVOKING | REVOKED | FAILED`  
Command: `PENDING | QUEUED | DISPATCHED | ACKED | SUCCEEDED | FAILED | EXPIRED | REVOKED`

## Handler keys

`agent.revalidate_auth`, `agent.validate_outbound`, `agent.validate_public_key_ref`, `agent.persist_registration`, `agent.activate`, `agent.validate_nonce`, `agent.enqueue_command`, `agent.spool_command`, `agent.mark_revoking`, `agent.revoke_pending_commands`, `agent.revoke_agent`, `agent.verify`.
