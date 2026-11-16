# P7.14 — Architecture

## Purpose

P7.14 is the **Connectivity Agent & Edge Agent Registry** layer for Private Cloud / On-Prem. It owns agent identity, signed outbound commands, local spool, and revocation. **Not required** for Shared SaaS reference path.

## Boundaries

| In scope | Out of scope |
|----------|--------------|
| Agent registry + commands + spool + evidence | Arbitrary shell / unrestricted remote exec |
| Register / command / revoke via P7.4 (`p714.agent.*`) | Inbound listeners / reverse tunnels |
| `outbound_only=true` always; vault `public_key_ref` | Plaintext keys in API/DB |
| Nonce unique anti-replay; revoke clears active cmds → REVOKED | Trusting client `outboundOnly=false` |

## Layering

```
Edge Console (/edge/provisioning/agents) / API client
  → EdgeConnectivityAgentController (RBAC platform:agents:*)
    → Use cases (create/register/command/revoke/list)
      → ConnectivityAgentRepositoryPort (Postgres, migration 110)
      → P7.4 workflow engine (definitions p714.agent.*)
        → LiveConnectivityAgentExecutor (handlers agent.*)
      → P7.1 authorization revalidation (fail-closed when provisioningRequestId bound)
```

## Hard dependencies

- **P7.1** — fail-closed when `provisioningRequestId` bound.
- **P7.4** — mutative register / command / revoke only via durable workflows; **10th** live executor (`AGENT_LIVE_EXECUTOR`).
- **Migration 110** — `110_edge_p7_connectivity_agent.sql` (108=P8, 109=P7.13).
