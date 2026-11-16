# 02 — Current Tenant Domain Inventory

## Backend — modules et fichiers clés

### Edge P7.11 Tenant Technical Lifecycle

| Couche | Chemin |
|---|---|
| Domain | `src/modules/edge/domain/tenant-lifecycle/` |
| Application | `src/modules/edge/application/tenant-lifecycle/lifecycle.use-cases.ts` |
| Infra | `src/modules/edge/infrastructure/tenant-lifecycle/` |
| API | `presentation/controllers/lifecycle.controller.ts` |
| Migration | `migrations/control-plane/106_edge_p7_tenant_lifecycle.sql` |

**Statuts techniques :** ACTIVE, SUSPENDING, SUSPENDED, RESUMING, MIGRATING, ARCHIVING, ARCHIVED, RESTORING, DEPROVISIONING, DEPROVISIONED, DATA_PURGED, FAILED

**API exposée :** list/get/create records ; suspend ; resume ; deprovision ; runs/evidence  
**Non exposé malgré SQL :** migrate, recover

### Identity Tenant

| Couche | Chemin |
|---|---|
| Entity | `src/modules/identity/domain/tenant/tenant.entity.ts` |
| Use cases | `application/tenant/tenant.use-cases.ts` |
| Controllers | `tenants.controller.ts`, platform `admin/tenants` |

**Statuts :** PROVISIONING, ACTIVE, SUSPENDED, READ_ONLY, DEACTIVATING, ARCHIVED, DELETED, FAILED, LOCKED

### Autres domaines Edge touchant tenant_id

- provisioning, placement, infrastructure, keycloak, configuration-entitlement, product-experience, readiness-activation, onboarding, product-control, workflow

### Frontend Edge

| Élément | État |
|---|---|
| `/edge/tenants` | **Absent** (nav disabled) |
| Modules P7.8–P7.12 | Présents (filtres `tenantId`) |
| `edgeApi` tenant CRUD | **Absent** |
| ERP `admin/tenants` | Shell séparé, Identity |

## Permissions existantes (extrait)

- `platform:lifecycle:*` (106)
- `platform:experience:*`, `platform:configuration:*`, …
- ERP : `tenant:read`, `tenant:update`, …
- **Manquant :** `platform:tenant_management:*` / gouvernance P8

## Tests existants (échantillon)

- `lifecycle-policy.spec.ts`, `lifecycle.controller.auth.spec.ts`
- `tenant-lifecycle-enterprise.spec.ts`, `cross-tenant.spec.ts`
- Frontend : `edge-lifecycle-module.test.tsx`

## Inventaire « fonctionnalité »

| Capacité | Niveau |
|---|---|
| Liste technique lifecycle | Partiel |
| Registry produit (P7.2) | Complet (≠ tenant) |
| Registry product tenants | Absent |
| 360° | Absent |
| Exceptions admin | Absent |
| Réconciliation globale | Absent |
| Analytics portefeuille tenants | Absent |
| Console Tenant Center | Absent |
