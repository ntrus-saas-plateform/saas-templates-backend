# P6 � Permissions Matrix

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE** � seeded in migration **`090`** (`platform:billing:*`)

| Permission | Typical use |
|------------|-------------|
| `platform:billing:read` | List billing accounts, invoices, payments |
| `platform:billing:create` | Create billing account / draft invoice |
| `platform:billing:update` | Edit draft invoice, profile (pre-issue) |
| `platform:billing:issue` | Issue invoice (immutable transition) |
| `platform:billing:void` | Void draft / governed void issued (audited) |
| `platform:billing:read_invoices` | Invoice detail + lines |
| `platform:billing:manage_schedules` | Billing schedule CRUD |
| `platform:billing:manage_profiles` | Bill-to + payment method refs |
| `platform:billing:read_payments` | Intents, attempts, receipt history |
| `platform:billing:collect` | Create payment intent / retry attempt |
| `platform:billing:confirm_payment` | Manual confirm path (governed � still requires proof record) |
| `platform:billing:refund` | Issue refund against confirmed payment |
| `platform:billing:credit` | Create credit memo |
| `platform:billing:read_ledger` | Ledger + reconciliation views |
| `platform:billing:reconcile` | Run / approve reconciliation batch |
| `platform:billing:read_collections` | Dunning cases |
| `platform:billing:manage_collections` | Advance collection stage (stub) |
| `platform:billing:read_tax` | Tax snapshots |
| `platform:billing:manage_tax` | Configure tax refs (minimal P6.0) |
| `platform:billing:read_analytics` | Billing KPIs (honest � excludes fake paid) |
| `platform:billing:manage_policies` | Billing / dunning / confirm policies |
| `platform:billing:manage_integrations` | Payment adapter config, webhook secrets (not in logs) |
| `platform:billing:manage_approvals` | High-value refund / void approvals |
| `platform:billing:coordinate` | Replay / ack P5 coordination (operator) |

## Role grants (target)

| Role | Grant |
|------|-------|
| `EDGE_PLATFORM_SUPER_ADMIN` | all `platform:billing:*` |
| `EDGE_PLATFORM_OPERATOR` | read/create/update, issue (policy), collect, read_payments, read_ledger, read_analytics � **no** refund/void without policy / **no** manage_integrations |
| `VERTICAL_OWNER` / `VERTICAL_ADMIN` | `read`, `read_invoices`, `read_analytics` (vertical-scoped) |

Server enforces every mutation; frontend gates are UX only.
