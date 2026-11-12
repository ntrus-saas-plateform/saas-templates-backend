# P7.7 — API Contract

**Controller:** `src/modules/edge/presentation/controllers/keycloak.controller.ts`
**Guards:** `EdgeAuthGuard` → `EdgeOptionalWorkspaceGuard` → `EdgePermissionGuard`; per-route `@RequireEdgePermissions`.
**Invariant:** mutations create/launch P7.4 workflow instances only — no endpoint mutates Keycloak directly.

## Endpoints

| Method | Path | Permission | Purpose / notes |
|--------|------|-----------|-----------------|
| GET | `edge/keycloak/providers` | `platform:keycloak:read` | List provider capability declarations → `{items,total}` |
| GET | `edge/keycloak/providers/:id` | `platform:keycloak:read` | Single provider |
| GET | `edge/keycloak/servers` | `platform:keycloak:read` | Registered servers (credential shown as opaque ref only) |
| GET | `edge/keycloak/servers/:id` | `platform:keycloak:read` | Single server |
| POST | `edge/keycloak/servers` | `platform:keycloak:manage` | Register server; `adminCredential` is **writeOnly** → vault; TLS/non-loopback rules; audit + history + outbox |
| POST | `edge/keycloak/servers/:id/capabilities` | `platform:keycloak:capabilities` | Real capability probe (serverinfo + org probe) → persisted capabilities, health, history, audit |
| GET | `edge/keycloak/servers/:id/capabilities` | `platform:keycloak:read` | Last discovered capabilities |
| GET | `edge/keycloak/topologies` | `platform:keycloak:read` | Filter: `tenantId`, `productId`, `status`, `topologyType`, `serverId`, `limit` (1–200), `offset` |
| GET | `edge/keycloak/topologies/:id` | `platform:keycloak:read` | Full detail: topology + realm + organization + clients + oidc + references + health + reconciliations + evidence |
| POST | `edge/keycloak/topologies` | `platform:keycloak:provision` | Create desired state + workflow (requires `provisioningRequestId`, P7.1 fail-closed); plan validated, fingerprinted, collision-checked |
| POST | `edge/keycloak/topologies/:id/reconcile` | `platform:keycloak:reconcile` | Launch reconcile workflow (idempotency key supported) |
| POST | `edge/keycloak/topologies/:id/deprovision` | `platform:keycloak:deprovision` | **Destructive:** requires `authorized: true` AND `confirmed: true` (else `DEPROVISION_FORBIDDEN`) |
| GET | `edge/keycloak/topologies/:id/evidence` | `platform:keycloak:history:read` | Operation evidence (`limit`, default 50, max 200) |
| GET | `edge/keycloak/topologies/:id/history` | `platform:keycloak:history:read` | Provisioning history (`KEYCLOAK_TOPOLOGY` trail) |
| GET | `edge/keycloak/topologies/:id/reconciliations` | `platform:keycloak:read` | Reconciliation runs with drift classification |
| POST | `edge/keycloak/clients` | `platform:keycloak:provision` | Declare a technical client → `p77.keycloak.topology.declare_client` workflow (policy-validated, provisioned by steps) |

## DTO validation highlights (`dto/keycloak.dto.ts`)

| DTO | Rules |
|-----|-------|
| `RegisterKeycloakServerDto` | `code` lowercase `[a-z0-9-]`, `baseUrl` URL, `adminCredential` writeOnly + max 4096, `tlsMode ∈ {REQUIRED, OPTIONAL_INSECURE_LOCAL}`, `environment` enum, `allowPrivateNetwork` boolean |
| `CreateKeycloakTopologyDto` | `provisioningRequestId` **required** (fail-closed), `topologyType` enum, `profileOptions` object (declarative P7.2 options), ids as strings |
| `DeclareKeycloakClientDto` | `clientKind` enum, `ownerFunction` (service/backend — never an end-user), `redirectUris` array, documented usage required |
| `DeprovisionKeycloakTopologyDto` | `authorized` + `confirmed` booleans mandatory |
| `KeycloakPaginationQueryDto` | `status`/`topologyType` enums, `limit` 1–200 |

## Permission model (migration 102)

| Permission | Description | Granted to |
|------------|-------------|------------|
| `platform:keycloak:read` | Read providers/servers/topologies | SUPER_ADMIN, OPERATOR |
| `platform:keycloak:manage` | Manage server registrations | SUPER_ADMIN |
| `platform:keycloak:provision` | Trigger provisioning / declare clients | SUPER_ADMIN |
| `platform:keycloak:reconcile` | Trigger reconciliation | SUPER_ADMIN, OPERATOR |
| `platform:keycloak:deprovision` | Authorize deprovisioning | SUPER_ADMIN |
| `platform:keycloak:history:read` | Read history + evidence | SUPER_ADMIN, OPERATOR |
| `platform:keycloak:capabilities` | Discover capabilities | SUPER_ADMIN, OPERATOR |

(`EDGE_PLATFORM_SUPER_ADMIN` receives all seven; `EDGE_PLATFORM_OPERATOR` receives read/reconcile/history/capabilities. Not auto-granted to other roles.)

## Error envelope

Domain errors surface `DomainError` codes (`FORBIDDEN`, `CONFLICT`, `VALIDATION_ERROR`, `DEPENDENCY_UNAVAILABLE`, …) with structured `details` carrying the P7.7 `KeycloakErrorCode` (`AUTHORIZATION_FAILED`, `TOPOLOGY_COLLISION`, `SSRF_BLOCKED`, `DEPROVISION_FORBIDDEN`, …).

## Frontend consumer

`saas-template-frontend/lib/api/edge.ts` (+144 lines): `listKeycloakProviders`, `listKeycloakServers`, `registerKeycloakServer`, `discoverKeycloakCapabilities`, `getKeycloakCapabilities`, `listKeycloakTopologies`, `getKeycloakTopology`, `createKeycloakTopology`, `reconcileKeycloakTopology`, `deprovisionKeycloakTopology`, `declareKeycloakClient`, `listKeycloakEvidence`, `listKeycloakHistory`, `listKeycloakReconciliations`. Console UI: `app/(edge-console)/edge/provisioning/keycloak/page.tsx` + `components/edge/keycloak/edge-keycloak-module.tsx` (TanStack Query, RBAC gates, servers/topologies/audit-history tabs, credential masking `••••••••`).
