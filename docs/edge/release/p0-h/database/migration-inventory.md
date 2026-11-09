# P0-H.1 — Migration 073 Inventory

**Source:** `migrations/control-plane/073_edge_foundation.sql` (+ post-audit amendment)

## Tables

| Table | PK | Notable constraints |
|-------|----|---------------------|
| `edge_administrators` | `id` UUID | UNIQUE `external_identity_id`, UNIQUE `email`; status CHECK |
| `edge_verticals` | `id` | UNIQUE `code`, UNIQUE `slug`; status CHECK |
| `edge_memberships` | `id` | UNIQUE `(administrator_id, vertical_id)`; FKs CASCADE; status CHECK |
| `edge_invitations` | `id` | UNIQUE `token_hash`; status CHECK; `invited_by` UUID **without FK** (bootstrap-safe) |
| `edge_permissions` | `id` | UNIQUE `code` |
| `edge_roles` | `id` | UNIQUE `code`; scope CHECK GLOBAL\|VERTICAL |
| `edge_role_permissions` | `(role_id, permission_id)` | FKs CASCADE |
| `edge_role_assignments` | `id` | FKs; **partial UNIQUE** active `(admin, role, COALESCE(membership_id, zero-uuid))` WHERE `revoked_at IS NULL` |
| `edge_workspace_sessions` | `id` | UNIQUE `token_hash`; FKs; status CHECK |
| `edge_delegations` | `id` | FKs to administrators |
| `edge_emergency_access_grants` | `id` | status CHECK; approver SET NULL |
| `edge_configuration_versions` | `id` | UNIQUE `(vertical_id, version)` |
| `edge_external_identity_mappings` | `id` | UNIQUE `(entity_type, entity_id, external_system)` |
| `edge_sync_records` | `id` | — |
| `edge_audit_events` | `id` | no FK (history preserved if subjects deleted) |

## Indexes

FK/status/token/email/audit indexes as defined in 073 (see SQL). Active role-assignment uniqueness added during H.1.

## Seeds

- ≥38 permission codes (`ON CONFLICT DO NOTHING`)
- 10 system roles: 4 GLOBAL + 6 VERTICAL
- Role→permission maps; vertical roles **exclude** platform-global create/activate/deactivate administrator perms (verified by test)

## Domain mapping

| Aggregate | Table(s) |
|-----------|----------|
| PlatformAdministrator | `edge_administrators` |
| Vertical | `edge_verticals` |
| VerticalMembership | `edge_memberships` |
| EdgeInvitation | `edge_invitations` |
| EdgeRole / Permission / Assignment | `edge_roles`, `edge_permissions`, `edge_role_permissions`, `edge_role_assignments` |
| WorkspaceSession | `edge_workspace_sessions` |
| EdgeDelegation | `edge_delegations` |
| EdgeEmergencyAccessGrant | `edge_emergency_access_grants` |
| WorkspaceConfigurationVersion | `edge_configuration_versions` |

## Intentionally application-enforced (not full SQL FSM)

- Legal status **transitions** (e.g. ACTIVE→SUSPENDED only from allowed states)
- Invitation single-use consumption races beyond UNIQUE token_hash
- Workspace session hash comparison / opacity
