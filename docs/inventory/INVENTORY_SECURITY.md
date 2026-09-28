# Inventory Security

## Authentication

- Staff JWT via Keycloak (`platform-api` / edge proxy)
- Tenant id **only** from token claims — never from body for authorization

## Authorization

### Module gate

`@RequireModule('inventory')` on inventory controllers.  
Org location APIs use organization module permissions.

### Permissions

| Permission | Use |
|------------|-----|
| `inventory:read` | Availability, ledger reconstruct, policies GET, counts list |
| `inventory:receive` | Receive stock |
| `inventory:reserve` | Reservations |
| `inventory:allocate` | FEFO allocation |
| `inventory:release` | Release holds |
| `inventory:transfer` | Transfers |
| `inventory:adjust` | Adjustments, quarantine/recall (existing), counts, policy PUT |
| `inventory:quarantine` / `inventory:recall` | Prefer when granted (047+) |
| `explain:read` | Ledger explain |
| `organizations:read` / `update` | Warehouse / zone / location CRUD |

### Scopes

- Organization: commands carry / infer `organizationId`; repos filter by it
- Warehouse: all lot mutations require a warehouse owned by org
- Location: must belong to warehouse via zone chain

## Threats mitigated

| Threat | Control |
|--------|---------|
| Cross-tenant IDOR | Tenant DB pool + JWT tenant |
| Cross-org warehouse | Org ownership check on warehouse/zone/location |
| Replay / double receive | Idempotency-Key store |
| Privilege escalation | Fine-grained `inventory:*` RBAC |
| Silent stock rewrite | Ledger-only corrections; audit actions on controllers |

## Audit

Controllers use `@AuditAction(...)` for receive, transfer, adjust, quarantine, recall, counts, policy updates.

## Secrets

No inventory secrets in tenant tables. Credentials remain control-plane / env.
