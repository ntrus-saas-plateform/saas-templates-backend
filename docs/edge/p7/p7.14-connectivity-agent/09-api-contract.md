# P7.14 — API Contract

Base: Edge authenticated routes under `/edge/agents/*` (and `/edge/agent-history`).

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/agents` | read |
| POST | `/edge/agents` | manage |
| GET | `/edge/agents/:id` | read (detail + commands + evidence + spool) |
| POST | `/edge/agents/:id/register` | manage → `p714.agent.register` |
| POST | `/edge/agents/:id/command` | command → `p714.agent.command` |
| POST | `/edge/agents/:id/revoke` | revoke → `p714.agent.revoke` |
| GET | `/edge/agents/:id/commands` | read |
| GET | `/edge/agents/:id/evidence` | history:read |
| GET | `/edge/agent-history` | history:read |

## Command body highlights

- `commandType` (allowlisted)
- `nonce` — required 64-char hex (anti-replay)
- `payloadRef` / `signatureRef` — vault refs

## Frontend

Console: `/edge/provisioning/agents`
