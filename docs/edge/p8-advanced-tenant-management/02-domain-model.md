# 02 — Domain Model (P8 Implementation)

## Aggregate root

`TenantRegistryRecord` (`edge_p8_tenants`) — product tenant administrative identity.

### Identity fields

`id`, `productTenantId`, `tenantCode`, `tenantSlug`, `displayName`, `productId`, optional `accountId` / `subscriptionId`, optional `platformTenantRef`.

### Independent status dimensions

| Dimension | Field | Owner |
|---|---|---|
| Administrative | `administrativeStatus` | P8 |
| Technical | `technicalStatus` (+ `technicalObservedAt`) | Projection P7 |
| Governance | `governanceStatus` | P8 |
| Health | `healthStatus` (+ `healthObservedAt`) | Observation / STALE |
| Risk | `riskLevel` | Assessments P8 |

### Child entities

- Tags (`edge_p8_tenant_tags`)
- Internal notes (`edge_p8_tenant_notes`)
- Lifecycle requests (`edge_p8_lifecycle_requests`)
- Exceptions (`edge_p8_exceptions`)
- Migration / recovery / termination requests (tables dédiées)
- Reconciliation runs + findings
- Activity events (append-only)
- Health / risk / analytics snapshots

## Invariants

1. Unique `productTenantId`, `tenantCode`, `tenantSlug`.
2. Single product per tenant (`productId` required).
3. Optimistic concurrency via `version`.
4. Sensitive mutations require justification + audit + outbox.
5. Self-approval forbidden for approvals.
6. Legal hold blocks termination.
7. Technical HEALTHY never invented without observation.

## State machines

Administrative transitions : voir `tenant-management-policy.ts`.

Lifecycle request types : SUSPEND, RESUME, RESTRICT, UNRESTRICT, DEACTIVATE, REACTIVATE, MIGRATE, RECOVER, TERMINATE, ARCHIVE.

Après approval administrative : statut admin mis à jour ; exécution technique déléguée P7 (`delegation: P7_PENDING`) jusqu’à branchement workflow.
