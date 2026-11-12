# P7.7 — Architecture

| Field | Value |
|-------|-------|
| **Date** | 2026-11-12 |
| **Branch** | `feature/console` |
| **Style** | Hexagonal / DDD inside the Edge modular monolith |
| **Scope** | Keycloak topology provisioning (Models A/B/C) — **no business IAM in Edge** |

---

## Placement (hexagonal layers)

```
presentation   controllers/keycloak.controller.ts + dto/keycloak.dto.ts
               (RBAC guards; mutations ONLY launch P7.4 workflows)
application    keycloak-topology/keycloak.use-cases.ts
               (TX: topology + version + history + audit + outbox; P7.1 revalidation)
domain         keycloak-topology/*.ts
               types · provider port · repository port · plan · state machine
               · handlers · events · validation context (+ .spec files)
infrastructure keycloak/keycloak-admin.adapter.ts   (REAL Keycloak Admin API)
               keycloak/live-keycloak.executor.ts   (handler-key dispatch)
               keycloak/pg-keycloak.repository.ts   (migration 102)
persistence    migrations/control-plane/102_edge_p7_keycloak_topology_provisioning.sql
```

### Dependency flow (inbound → outbound)

| Direction | From → To | Rule |
|-----------|-----------|------|
| Inbound | HTTP → controller → use case | No endpoint mutates Keycloak directly |
| Outbound | use case / executor → `KeycloakProviderPort` | Domain never imports HTTP details |
| Outbound | use case / executor → `KeycloakRepositoryPort` | PostgreSQL only, optimistic `version` |
| Outbound | use case → `SecretsProviderPort` | Secrets vault; `credential_ref` only in DB |
| Outbound | use case → `ControlPlaneOutboxTransactionService` | State + audit + outbox in one TX |

## Explicit non-choices

| Topic | Decision |
|-------|----------|
| Business IAM (tenant end-users, org memberships, business roles/permissions, customer invitations) | **Forbidden in Edge** — business backends own it; migration 102 constraints `noBusinessUsers` / `noBusinessRoles` |
| Plaintext secrets in PostgreSQL | **Forbidden** — opaque `credential_ref` columns only |
| Direct mutations from the API layer | **Forbidden** — workflow-only invariant (P7.4) |
| Simulated success when no live executor | **Forbidden** — handler fails `DEPENDENCY_UNAVAILABLE` |
| P7.8+ concerns (deployment configs, product provisioning, readiness/activation) | **NOT implemented** — declared boundary |

## Components

| Component | File | Role |
|-----------|------|------|
| Domain vocabulary | `domain/keycloak-topology/keycloak.types.ts` | Enums, records, `KEYCLOAK_HANDLER_KEYS`, `KEYCLOAK_TABLES` |
| Provider port | `keycloak-provider.port.ts` | Single seam to a Keycloak server |
| Repository port | `keycloak-repository.port.ts` | Mirror of migration 102 (transactional, versioned) |
| Plan + fingerprint | `keycloak-plan.ts` | Fail-closed validation, realm/org name derivation, SHA-256 fingerprint |
| State machine | `keycloak-state-machine.ts` | Mandated transitions; `READY` requires `VERIFYING` |
| Workflow handlers | `keycloak-handlers.ts` | `KeycloakProvisioningHandler` (fencing, approval-gated compensation) |
| Use cases | `application/keycloak-topology/keycloak.use-cases.ts` | Orchestration, workflow definitions, TX boundaries |
| HTTP adapter | `infrastructure/keycloak/keycloak-admin.adapter.ts` | `HttpKeycloakAdminAdapter` (SSRF guard, vault, retries) |
| Live executor | `infrastructure/keycloak/live-keycloak.executor.ts` | Dispatch on handler key → real operations + evidence |
| PG repository | `infrastructure/keycloak/pg-keycloak.repository.ts` | SQL against migration 102 |

## Reuse of P7.1–P7.6

| Capability | Source |
|------------|--------|
| Provisioning authorization, fail-closed revalidation | P7.1 (`WorkflowAuthorizationPort.revalidateBoundAuthorization`) |
| Product / platform / environment / deployment profiles | P7.2 registry (`FK` to `edge_products`, `edge_p7_deployment_profiles`) |
| Placement decisions (workflow-ready check) | P7.3 (`WorkflowPlacementPort`) |
| Durable steps, leases, fencing, compensation, human approvals | P7.4 workflow engine |
| Outbox + audit TX pattern | `ControlPlaneOutboxTransactionService`, `EDGE_P7_OUTBOX_TENANT` |
| Secrets vault abstraction | P7.6 `SecretsProviderPort` (extended in P7.7 with single-value `put`) |
| Provider abstraction style | P7.6 infrastructure provisioning |

## Wiring

- `edge.module.ts` registers `EdgeKeycloakController`.
- `edge-application.providers.ts` provides `KEYCLOAK_PROVIDER_PORT → HttpKeycloakAdminAdapter`, all use cases, and `KEYCLOAK_LIVE_EXECUTOR`.
- `edge-persistence.module.ts` provides `KEYCLOAK_REPOSITORY_PORT → PgKeycloakRepository`.
- `workflow-handler.registry.ts` injects `KEYCLOAK_LIVE_EXECUTOR` and calls `registerKeycloakHandlers(...)` — same registry used by P7.4 workers.
