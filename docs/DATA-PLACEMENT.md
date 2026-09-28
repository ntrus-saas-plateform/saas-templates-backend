# Data placement (ADR)

Control plane vs tenant database boundaries.

## Control plane database (`platform_control`)

Cross-tenant registry, identity, RBAC, and customer core:

| Data | Rationale |
|------|-----------|
| `tenants`, `tenant_profile`, `tenant_owners` | Registry and ownership |
| `organizations` | Org metadata + Keycloak org id mapping |
| `user_tenant_memberships` | Which identities belong to which tenant |
| `application_users` | Per-tenant staff user profiles |
| `user_organization_memberships`, `roles`, `permissions` | RBAC catalog and org memberships |
| `invitations` | Pending invites (token hash only) |
| `delegations`, `emergency_access_grants` | Audited privilege elevation |
| `global_customers`, `global_customer_identities` | Platform-owned B2C identity |
| `tenant_customers`, `organization_customers` | Customer relationship metadata |
| `global_customer_consents`, `global_customer_addresses` | Consent and address history |
| `control_plane_outbox_events` | CP transactional outbox (`customer.*`, `membership.*`, `organization.*`, `user.*`) |
| `reconciliation_reports` | Keycloak drift history |

## Tenant database (per tenant)

Tenant-scoped operational data isolated by DB-per-tenant:

| Data | Module / migration |
|------|-------------------|
| `outbox_events`, `inbox_messages` | Messaging (`001_initial`) |
| `tenant_settings`, `organization_settings` | Identity settings overrides (`003_user_profile_settings`) |
| `user_preferences` | User prefs (`002_user_preferences`) |
| `integration_event_log` | Event audit (`003_integration_event_log`) |
| `customer_interactions`, `customer_timeline_events` | Customer CRM (`004_customer_operations`, `007_timeline_idempotency`) |
| Commercial catalog / inventory / pricing / sales / fulfillment / finance tables | Tenant commercial engine (`016_commercial_core`) — products, stock_lots, inventory_*, price_*, carts, sales_*, pick_tickets, shipments, commercial_invoices/payments |

Patient role fields live on control-plane `tenant_customers` / `global_customers`. Former commerce tables were dropped (`015_drop_commerce`). Commercial credit fields on control-plane `tenant_customers` (`042_customer_commercial_profile`).

## Event / outbox routing

| Event prefix | Outbox location | Co-located writes |
|--------------|-----------------|-------------------|
| `customer.*`, `membership.*`, `organization.*`, `user.*` | Control plane | CP repositories |
| `commerce.*`, `settings.*`, `platform.*` | Tenant DB | Tenant repositories |

## Rules

1. **JWT + control plane** resolve tenant, organization, and permissions — never trust headers/body for tenant scope.
2. **Active organization** comes from Keycloak JWT (`organization` scope); app DB validates membership.
3. **Keycloak** is source of truth for credentials, sessions, MFA; single realm with `tenant_id` claim.
4. **Reconciliation job** compares KC ↔ control plane and records drifts.
5. Domain writes and outbox enqueue use **the same transaction** on the database that owns the data.

## Migration ownership

- `migrations/control-plane/` — platform operators, all tenants
- `migrations/tenant/` — applied per tenant pool on provision/migrate (`schema_migrations` skip logic)
