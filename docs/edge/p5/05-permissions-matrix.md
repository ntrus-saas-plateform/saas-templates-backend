# P5 — Permissions Matrix

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE** — seeded in migration **`087`** (`platform:subscriptions:*`)

| Permission | Typical use |
|------------|-------------|
| `platform:subscriptions:read` | List / detail subscription |
| `platform:subscriptions:create` | Create draft (incl. from handoff) |
| `platform:subscriptions:update` | Edit draft metadata / composition (pre-activate) |
| `platform:subscriptions:approve` | Approve subscription or change (governance) |
| `platform:subscriptions:activate` | Activate after gates |
| `platform:subscriptions:suspend` | Suspend |
| `platform:subscriptions:reactivate` | Reactivate from suspended |
| `platform:subscriptions:cancel` | Cancel at term / soft cancel |
| `platform:subscriptions:terminate` | Hard terminate |
| `platform:subscriptions:renew` | Initiate / confirm renewal |
| `platform:subscriptions:change_plan` | Plan change requests |
| `platform:subscriptions:manage_addons` | Add-on attach/detach |
| `platform:subscriptions:manage_trials` | Trial start / extend / convert |
| `platform:subscriptions:read_enterprise` | View enterprise policy overlays |
| `platform:subscriptions:manage_enterprise` | Configure enterprise subscription rules |
| `platform:subscriptions:read_entitlements` | Read snapshots / effective view |
| `platform:subscriptions:publish_entitlements` | Publish new entitlement snapshot |
| `platform:subscriptions:reconcile_entitlements` | Reconcile read models vs snapshots |
| `platform:subscriptions:manage_policies` | Activation / provisioning policy CRUD |
| `platform:subscriptions:read_analytics` | Honest subscription analytics |
| `platform:subscriptions:manage_approvals` | Approval queue (changes / enterprise) |
| `platform:subscriptions:manage_integrations` | Configure P6/P7 adapter endpoints (not secrets in logs) |

## Role grants (target)

| Role | Grant |
|------|-------|
| `EDGE_PLATFORM_SUPER_ADMIN` | all `platform:subscriptions:*` |
| `EDGE_PLATFORM_OPERATOR` | read/create/update, trials, addons, change_plan, renew (no terminate), read_entitlements, read_analytics — **no** manage_enterprise / publish without policy / manage_integrations |
| `VERTICAL_OWNER` / `VERTICAL_ADMIN` | `read`, `read_entitlements`, `read_analytics` (vertical-scoped) |

Server enforces every mutation; frontend gates are UX only.
