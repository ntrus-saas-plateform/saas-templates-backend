# P7.3 — Placement & Capacity Management — Inspection & Design

| Field | Value |
|-------|-------|
| **Status** | INSPECTION COMPLETE — design proposal only (no implementation) |
| **Date** | 2026-11-10 |
| **Depends on** | P7.1 (authorization foundation), P7.2 (registry + compatibility) |
| **Explicitly out of scope** | P7.4 workflow engine, P7.5 live BB calls, P7.6 infra adapters, P7.7 Keycloak create, tenant ACTIVE |

---

## 0. Repository baseline (verified)

### Backend — `e:\whatif\saas-templates-backend`

| Check | Result |
|-------|--------|
| Branch | `feature/console` |
| HEAD | `7f63ded5d4f5029248221d550cf5a17cb002ef7c` |
| Tracking | `feature/console...origin/feature/console` |

```
7f63ded fix(P7.2): remediate audit findings for TX atomicity, fail-closed compat, DTOs, and profile certification.
915e323 fix(P7.2): complete outbox version events, OpenAPI DTOs, tests, migrate proof
beb80b2 fix(P7.2): close registry gaps for version GET, product FK, release channel
62ffca5 feat(P7.2): product platform runtime registry with compatibility engine
e014d8c fix(P7.1): separate S2S identities, global OQ-04 deadline, mandatory audit/outbox
```

### Frontend — `e:\whatif\saas-template-frontend`

| Check | Result |
|-------|--------|
| Branch | `feature/console` |
| HEAD | `4ea77325020ae0c1f1d9d4b7ffa897f79744fb1d` |
| Tracking | `feature/console...origin/feature/console` |

```
4ea7732 test(P7.2): add Registry UI integration coverage beyond helper unit tests.
dbfe650 fix(P7.2): use canonical STABLE release channels in registry UI
2fb5805 feat(P7.2): Edge console Registry Management UI
abe9dbf P7.1 On progress
b7b2f07 already P6? P7 on processing
```

**Verdict:** both repos confirmed on `feature/console`. P7.2 remediation is HEAD on backend; Registry UI is HEAD on frontend. Safe to design P7.3 on this baseline.

---

## 1. P7.2 registry inventory (consume-only for P7.3)

### 1.1 Migrations

| File | Role |
|------|------|
| `migrations/control-plane/096_edge_p7_product_platform_runtime_registry.sql` | Schema + seeds + permissions |
| `migrations/control-plane/097_edge_p7_deployment_profile_certification_remediation.sql` | Data remediation only (demote seed profiles CERTIFIED → UNCERTIFIED) |

**Last numbered control-plane migration:** `097`.  
**Next P7.3 migration must be:** `098_edge_p7_placement_capacity_management.sql` (proposed).

**Note on 097:** file is idempotent `UPDATE`s but **omits** `INSERT INTO schema_migrations`. Runner `scripts/migrate-control-plane.ts` does **not** auto-insert versions — it relies on SQL files (pattern of 095/096). Consequence: 097 may re-apply every migrate run (harmless given WHERE guards). **P7.3 `098` must include `schema_migrations` insert** like 095/096.

### 1.2 Tables created by 096

| Table | Purpose |
|-------|---------|
| `edge_p7_product_registry` | Technical product registry (FK → `edge_products`) |
| `edge_p7_product_technical_versions` | Versioned technical releases |
| `edge_p7_product_platforms` | Product platforms |
| `edge_p7_runtime_environments` | Runtime environments under a platform |
| `edge_p7_deployment_profiles` | Canonical deployment profiles (seeded) |
| `edge_p7_product_control_contracts` | Product↔platform control contracts |
| `edge_p7_compatibility_evaluations` | Deterministic evaluation audit trail |
| `edge_p7_registry_history` | Unified registry history |

### 1.3 Domain types

**Path:** `src/modules/edge/domain/registry/registry.types.ts`

Key enums P7.3 must treat as immutable vocabulary:

| Enum | Values relevant to placement |
|------|------------------------------|
| `CompatibilityResult` | `COMPATIBLE` \| `INCOMPATIBLE` \| `REQUIRES_REVIEW` |
| `RegistryLifecycleStatus` | DRAFT…RETIRED (product must be CERTIFIED + `provisionable`) |
| `CertificationStatus` | UNCERTIFIED…REVOKED |
| `TechnicalVersionStatus` | DRAFT…RETIRED (PUBLISHED required) |
| `PlatformType` | SHARED_SAAS_PLATFORM, DEDICATED_PLATFORM, PRIVATE_PLATFORM, ON_PREMISE_PLATFORM |
| `PlatformOperationalStatus` | DRAFT…RETIRED (ACTIVE required) |
| `RuntimeEnvironmentType` | DEVELOPMENT, TEST, STAGING, PRODUCTION |
| `EnvironmentStatus` | DRAFT…RETIRED (ACTIVE required) |
| `DeploymentProfileCode` | SHARED_SAAS, DEDICATED_DATA, DEDICATED_RUNTIME, PRIVATE_CLOUD, ON_PREMISE |
| `ProfileStatus` | DRAFT…RETIRED |
| `ControlContractStatus` | DRAFT…RETIRED |
| `RegistryResourceType` | includes `COMPATIBILITY_EVALUATION` |

Record types: `ProductRegistryRecord`, `ProductTechnicalVersion`, `ProductPlatform`, `RuntimeEnvironment`, `DeploymentProfile`, `ProductControlContract`, `CompatibilityEvaluation`, `RegistryHistoryEntry`.

### 1.4 Repository port

**Symbol:** `REGISTRY_REPOSITORY_PORT`  
**Interface:** `RegistryRepositoryPort`  
**Path:** `src/modules/edge/domain/registry/registry-repository.port.ts`  
**Impl:** `src/modules/edge/infrastructure/registry/pg-registry.repository.ts`

Methods P7.3 placement will **read** (not mutate registries):

- `getProductRegistry`, `getProductRegistryByProductId`, `listProductRegistries`
- `getTechnicalVersion`, `listTechnicalVersions`
- `getPlatform`, `listPlatforms`
- `getEnvironment`, `listEnvironments`
- `getProfile`, `getProfileByCode`, `listProfiles`
- `getContract`, `listContracts`
- `saveCompatibilityEvaluation` / `getCompatibilityEvaluation` / `listCompatibilityEvaluations` (placement may re-evaluate or bind a prior evaluation id)
- `appendHistory` / `listHistory` (only if P7.3 writes registry-adjacent history — prefer dedicated placement history instead)

All mutating methods accept optional `client?: unknown` for TX sharing (P7.2 remediation).

### 1.5 Compatibility engine results

**Path:** `src/modules/edge/domain/registry/compatibility-engine.ts`  
**Function:** `evaluateRegistryCompatibility(input): Omit<CompatibilityEvaluation, 'id' | 'createdAt'>`  
**Use-case:** `EvaluateCompatibilityUseCase` in `application/registry/registry.use-cases.ts`  
**HTTP:** `POST /api/v1/edge/registry/compatibility/evaluate`  
**Permission:** `platform:registry_compatibility:evaluate`

Decision table (fail-closed):

| Condition | `CompatibilityResult` |
|-----------|----------------------|
| ≥1 blocker rule failed | `INCOMPATIBLE` |
| 0 blockers, ≥1 review-only failure | `REQUIRES_REVIEW` |
| All rules OK | `COMPATIBLE` |

Empty allowlists → `REQUIRES_REVIEW` (never implicit match). Explicit mismatch → `INCOMPATIBLE`. Missing resources → use-case validation error (never silent COMPATIBLE).

**P7.3 placement policy must refuse automatic placement unless result is `COMPATIBLE`.**  
`REQUIRES_REVIEW` → operator decision path.  
`INCOMPATIBLE` → hard reject.

Persisted columns on `edge_p7_compatibility_evaluations`:  
`result`, `rules_applied`, `reasons`, `examined_refs`, FKs to the six registry resources, `correlation_id`, `evaluated_by`, `evaluated_at`.

---

## 2. P7.1 authorization — entities & fields P7.3 can consume

### 2.1 Migrations / tables

**File:** `migrations/control-plane/095_edge_p7_provisioning_authorization_foundation.sql`

| Table | Role |
|-------|------|
| `edge_provisioning_authorizations` | Verified P5 authorization storage |
| `edge_p7_provisioning_requests` | Durable P7.1 request (not a technical workflow) |
| `edge_p7_provisioning_request_history` | Append-only status history |
| `edge_p7_authorization_revocation_inbox` | Revocation dedup inbox |

### 2.2 Domain types & entities

| Artifact | Path |
|----------|------|
| Types / enums | `src/modules/edge/domain/provisioning/provisioning.types.ts` |
| Request entity | `src/modules/edge/domain/provisioning/provisioning-request.entity.ts` (`ProvisioningRequestProps`) |
| Stored auth type | `StoredProvisioningAuthorization` in `provisioning-repository.port.ts` |
| Canonical P5 payload | `CanonicalProvisioningAuthorization` |
| Port | `PROVISIONING_REPOSITORY_PORT` / `ProvisioningRepositoryPort` |
| Impl | `src/modules/edge/infrastructure/provisioning/pg-provisioning.repository.ts` |
| Use-cases | `src/modules/edge/application/provisioning/provisioning.use-cases.ts` |
| Controller | `src/modules/edge/presentation/controllers/provisioning.controller.ts` → `@Controller('edge/provisioning-requests')` |
| Events / outbox tenant | `src/modules/edge/domain/provisioning/provisioning.events.ts` — `EDGE_P7_OUTBOX_TENANT = 'edge-control-plane'` |

### 2.3 Immutable commercial / trust refs available today

#### `StoredProvisioningAuthorization` (DB row → domain)

| Field | Type (domain) | Notes for P7.3 |
|-------|---------------|----------------|
| `id` | `string` (UUID) | **authorization_row_id** — primary durable handle |
| `authorizationId` | `string` (UUID) | P5 authorization id (versioned with below) |
| `authorizationVersion` | `number` | Immutable version key |
| `schemaVersion` | `string` | default `p5.provisioning_authorization.v1` |
| `authorizationType` | `string` | PROVISION / SUSPEND / RESUME / DECOMMISSION / UPDATE / MIGRATE |
| `operation` | `string` | Operation string |
| `accountId` | `string` | Account |
| `subscriptionId` | `string` | Subscription |
| `productId` | `string` | **P1 commercial product id** (not registry id) |
| `productTenantId` | `string \| null` | Conditional reuse only |
| `correlationId` | `string` | Cross-phase correlation |
| `causationId` | `string \| null` | |
| `idempotencyKey` | `string` | |
| `decision` | `string` | ALLOW / DENY |
| `authorizationStatus` | `string` | ISSUED / ACTIVE / REVOKED / EXPIRED / SUPERSEDED |
| `decisionReasonCode` | `string \| null` | |
| `decisionTimestamp` | `Date` | |
| `issuedAt` | `Date` | |
| `notBefore` | `Date \| null` | |
| `expiresAt` | `Date \| null` | Placement must re-check freshness |
| `entitlementSnapshotReference` | `string` | Opaque P5 snapshot ref |
| `entitlementVersion` | `string` | |
| `issuer` / `audience` / `keyId` | `string` | Trust metadata (`audience` = `okapi.edge.p7`) |
| `signatureAlgorithm` | `string` | |
| `payloadDigest` | `string` | Integrity digest |
| `signaturePresent` | `boolean` | |
| `issuedByServiceIdentity` | `string` | |
| `revocationStatus` | `RevocationStatus \| string` | NOT_REVOKED / REVOKED |
| `revocationVersion` | `number \| null` | |
| `revokedAt` / `revocationReasonCode` / `revocationReference` | nullable | |
| `environmentSlot` | `ProvisioningEnvironmentSlot \| string` | PROD / STAGING / DR / TEMP_TEST |
| `verificationStatus` | `AuthorizationVerificationStatus \| string` | PENDING / VERIFIED / REJECTED / REVOKED / EXPIRED |
| `verificationReasonCode` | `string \| null` | |
| `verifiedAt` | `Date \| null` | |
| `payloadSnapshot` | `Record<string, unknown>` | Sanitized snapshot (no raw signature) |
| `createdAt` / `updatedAt` | `Date` | |

#### `ProvisioningRequestProps` (placement input candidate)

| Field | Notes for P7.3 |
|-------|----------------|
| `id` | **request_id** — primary placement subject |
| `requestNumber` | Human/ops number |
| `authorizationId` + `authorizationVersion` | Immutable P5 key |
| `authorizationRowId` | FK to `edge_provisioning_authorizations.id` |
| `operation`, `accountId`, `productId`, `subscriptionId` | Commercial identity |
| `productTenantId` | May be null until later phases |
| `correlationId`, `causationId` | Continuity |
| `requestStatus` | Placement only for `ACCEPTED` |
| `environmentSlot` | Slot ≠ RuntimeEnvironment (OQ-03) |
| `idempotencyKey`, `deduplicationReference` | |
| `payloadDigest`, `entitlementSnapshotReference`, `policyVersion` | Frozen commercial refs |
| `rejectionReasonCode`, `cancellationReason` | Terminal paths |
| `source`, `createdBy`, `lastActor`, `metadata` | Ops context (`metadata.reuseDecision` today) |
| Timestamps | `receivedAt`, `acceptedAt`, … |

#### HTTP summary (`GetProvisioningAuthorizationSummaryUseCase`)

Exposed subset via `GET …/provisioning-requests/:id/authorization`:

`id`, `authorizationId`, `authorizationVersion`, `operation`, `accountId`, `productId`, `subscriptionId`, `decision`, `authorizationStatus`, `revocationStatus`, `verificationStatus`, `verificationReasonCode`, `issuer`, `audience`, `keyId`, `signatureAlgorithm`, `payloadDigest`, `issuedAt`, `expiresAt`, `environmentSlot`, `entitlementSnapshotReference`.

### 2.4 Port methods available

`ProvisioningRepositoryPort`:

- `getAuthorizationById`, `getAuthorizationByVersion`
- `getRequestById`, `findRequestByAuthOpVersion`, `findRequestByIdempotencyKey`
- `listRequests`, `listRequestHistory`, `getRequestStats`
- `upsertAuthorization`, `markAuthorizationRevoked`, `applyRevocationAtomically`, …
- `createRequest`, `transitionRequest`

**No placement/capacity methods exist.**

### 2.5 Permissions (095)

- `platform:provisioning_requests:read`
- `platform:provisioning_requests:read_history`
- `platform:provisioning_requests:cancel`
- `platform:provisioning_authorizations:read`

Granted to `EDGE_PLATFORM_SUPER_ADMIN` and `EDGE_PLATFORM_OPERATOR`.

---

## 3. ControlPlaneOutboxTransactionService + audit `create(client)` (P7.2 remediation pattern)

### 3.1 Service

**Path:** `src/shared/messaging/control-plane-outbox-transaction.service.ts`

```ts
async runWithOutbox<T>(
  tenantId: string,
  fn: (client: unknown, enqueue: (event: IntegrationEvent) => Promise<string>) => Promise<T>,
): Promise<T>
```

Tenant constant: `EDGE_P7_OUTBOX_TENANT` (`'edge-control-plane'`) from `provisioning.events.ts` (shared by P7.1/P7.2).

### 3.2 Audit port

**Path:** `src/modules/edge/domain/ports/audit-event-repository.port.ts`

```ts
create(params: CreateAuditEventParams, client?: unknown): Promise<EdgeAuditEvent>
```

**Impl:** `PgAuditEventRepository.create` uses `client` as `PoolClient` when provided — same TX as mutation/outbox.

### 3.3 Canonical P7.2 pattern (mandatory for P7.3)

From `registry.use-cases.ts` (`requireAudit(..., client)` + `runWithOutbox`):

1. Open **one** TX via `outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => { … })`.
2. Persist domain mutation(s) with `repo.*(…, client)`.
3. Append history with `client`.
4. `await enqueue(integrationEvent)`.
5. `await requireAudit(audit, { eventType, actorId, subjectType, subjectId, details }, client)` where failure → `DomainError(DEPENDENCY_UNAVAILABLE)`.
6. Return domain result; commit is implicit on success.

Security review evidence: `docs/edge/p7/p7.2-product-platform-runtime-registry/09-security-review.md` — atomicité mutation+history+audit+outbox.

### 3.4 P7.1 contrast (do **not** copy for P7.3)

P7.1 `provisioning.use-cases.ts`:

- `enqueueP7` opens a **separate** `runWithOutbox` solely to enqueue.
- `requireAudit` calls `audit.create(input)` **without** `client`.
- Accept path is therefore **not** single-TX for request write + audit + outbox.

**P7.3 must follow P7.2 remediation TX pattern**, and may later back-port atomicity to P7.1 (out of P7.3 scope unless required for shared helpers).

---

## 4. Migration numbering & runner conventions

| Convention | Detail |
|------------|--------|
| Directory | `migrations/control-plane/` |
| Naming | `NNN_edge_<domain>_<slug>.sql` (zero-padded 3 digits) |
| Apply | `npm run migrate:control` → `scripts/migrate-control-plane.ts` |
| Ordering | Lexicographic `readdirSync(…).filter(.sql).sort()` |
| Version key | Filename without `.sql` |
| Bookkeeping | SQL file itself `INSERT INTO schema_migrations (version) VALUES ('…') ON CONFLICT DO NOTHING` |
| Runner behavior | Skip if version already in `schema_migrations`; otherwise execute whole file inside outer BEGIN/COMMIT |
| Check scripts | `scripts/check-provisioning-migrations.ts` (095); `scripts/check-registry-migrations.ts` (096) — add `check-placement-migrations.ts` for 098 |

**Last file:** `097_edge_p7_deployment_profile_certification_remediation.sql`  
**Proposed next:** `098_edge_p7_placement_capacity_management.sql`

Dependencies already present: `edge_products`, `edge_permissions`, `edge_roles`, `edge_role_permissions`, `schema_migrations`, P7.1 tables, P7.2 tables.

---

## 5. Edge permissions seed pattern (from 096)

Pattern to replicate in `098`:

1. `INSERT INTO edge_permissions (code, description) VALUES (…) ON CONFLICT (code) DO NOTHING;`
2. Grant all new codes to `EDGE_PLATFORM_SUPER_ADMIN` via `CROSS JOIN` / `LIKE` or explicit `IN`.
3. Grant a **read + limited manage** subset to `EDGE_PLATFORM_OPERATOR`.
4. Do **not** invent new roles.

096 codes (reference style):

- `platform:product_registry:{read,manage,certify}`
- `platform:product_platforms:{read,manage}`
- `platform:runtime_environments:{read,manage}`
- `platform:deployment_profiles:{read,manage}`
- `platform:product_control_contracts:{read,manage,certify}`
- `platform:registry_compatibility:evaluate`
- `platform:registry_history:read`

**Proposed P7.3 permissions:**

| Code | Description |
|------|-------------|
| `platform:capacity_pools:read` | List/view capacity pools |
| `platform:capacity_pools:manage` | Create/update/adjust capacity pools |
| `platform:placement_policies:read` | Read placement policies |
| `platform:placement_policies:manage` | Manage placement policies |
| `platform:placement_decisions:read` | List/view placement decisions |
| `platform:placement_decisions:decide` | Run / confirm / reject placement |
| `platform:placement_history:read` | Placement decision history |

---

## 6. Frontend Edge console nav — where to add Placement & Capacity

### 6.1 Current shell

**File:** `saas-template-frontend/components/edge/edge-shell.tsx`  
**Array:** `PLATFORM_NAV`

Existing provisioning-related entries:

| Label | `href` |
|-------|--------|
| Provisioning Ops | `/edge/provisioning-requests` |
| Registry Management | `/edge/provisioning/registry` |

Tenant Management remains `disabled: true` at `/edge/tenants`.

### 6.2 Existing routes

| Route | Status |
|-------|--------|
| `app/(edge-console)/edge/provisioning-requests/` | P7.1 UI |
| `app/(edge-console)/edge/provisioning/registry/` (+ `[section]/[id]`) | P7.2 UI |
| `…/provisioning/capacity` | **Absent** |

### 6.3 Backlog target (P7.0.10)

From `docs/edge/p7/p7.0-repository-audit/10-frontend/P7.0.10_P7_SCREEN_AND_NAVIGATION_BACKLOG.md`:

| Order | Screen | Route | Phase |
|-------|--------|-------|-------|
| 9–10 | Capacity / Placement | `/edge/provisioning/capacity` | P7.3 |

### 6.4 Proposed FE insertion

1. Add nav item in `PLATFORM_NAV` **immediately after** Registry Management:

```ts
{
  href: "/edge/provisioning/capacity",
  label: "Placement & Capacity",
  icon: /* e.g. Gauge or MapPinned from lucide-react */,
},
```

2. Create pages under:

- `app/(edge-console)/edge/provisioning/capacity/page.tsx` — pools + decisions hub
- `app/(edge-console)/edge/provisioning/capacity/pools/[id]/page.tsx` (optional detail)
- `app/(edge-console)/edge/provisioning/capacity/decisions/[id]/page.tsx` (optional detail)

3. Reuse: `EdgePermissionGate`, `useEdgePlatform`, Edge empty/forbidden states, patterns from `components/edge/registry/*` and `lib/edge/registry`.

4. Client module (proposed): `lib/edge/placement.ts` + `types/edge-placement.ts`.

---

## 7. DTO / ValidationPipe conventions

### 7.1 Global pipe (`src/main.ts`)

```ts
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
})
```

### 7.2 P7.2 DTO conventions to copy

**Path:** `src/modules/edge/presentation/dto/registry.dto.ts`

- Header comment documenting whitelist / forbidNonWhitelisted semantics.
- `class-validator` + `class-transformer` (`@Type(() => Number)` for query ints).
- `@ApiProperty` / `@ApiPropertyOptional` for OpenAPI.
- Domain enums imported and constrained with `@IsEnum`.
- UUIDs via `@IsUUID('4')`.
- Pagination: `limit` 1–100, `offset` ≥0, optional `status`, `q`.
- PATCH DTOs omit identity/lifecycle fields; transitions use dedicated `Transition*Dto` endpoints.
- Spec: `registry.dto.spec.ts` with `plainToInstance` + `validate`.

**P7.3 proposed:** `src/modules/edge/presentation/dto/placement.dto.ts` (+ `placement.dto.spec.ts`) following the same rules.

Controllers use `@EdgeRoute`, `EdgeAuthGuard`, `EdgeOptionalWorkspaceGuard`, `EdgePermissionGuard`, `@RequireEdgePermissions(...)`.

---

## 8. Gaps — what P7.1 does **not** expose that P7.3 needs (typed port gap)

P7.1 is intentionally **authorization acceptance only** (zero technical placement). Gaps:

| Needed by P7.3 | P7.1 today | Gap type |
|----------------|------------|----------|
| Link request → product **registry** id | Only `productId` (P1 catalog) | No typed join / snapshot |
| Link request → technical version / platform / environment / profile / contract | Absent | Must be chosen by placement |
| Bind request → `compatibilityEvaluationId` | Absent | Must be created/stored by P7.3 |
| Capacity pool / headroom / reservations | Absent | BUILD |
| Placement decision + rationale + policy version | Absent | BUILD |
| Tenant runtime assignment (OQ-03) | Absent (explicitly deferred) | BUILD in P7.3 (decision record; execution later) |
| Typed “placement-ready” projection | `getRequestById` returns raw `ProvisioningRequestProps` | **Typed port gap** |
| Filter `ACCEPTED` requests eligible for placement | `listRequests` has status filter but no placement eligibility semantics | Soft gap |
| Freeze immutable commercial refs at placement time | Fields exist on auth/request but no **placement snapshot** aggregate | BUILD |
| Atomic TX for accept path | Split outbox/audit | Follow P7.2 pattern for P7.3 writes |
| Region / residency / quota from P5 auth body | Not first-class columns (only `payloadSnapshot` / entitlement refs) | Resolve via entitlement snapshot + registry constraints, not invent |
| Slot ≠ environment mapping | `environmentSlot` only | Placement must map slot → candidate `RuntimeEnvironment`s |

### 8.1 Proposed typed read port (minimal EXTEND)

Add a **new** port (do not overload `ProvisioningRepositoryPort` with capacity writes):

**Proposed:** `PlacementAuthorizationViewPort`  
**Path:** `src/modules/edge/domain/placement/placement-authorization-view.port.ts`  
**Symbol:** `PLACEMENT_AUTHORIZATION_VIEW_PORT`

```ts
export type PlacementReadyAuthorizationView = {
  requestId: string;
  requestNumber: string;
  requestStatus: 'ACCEPTED'; // narrowed
  authorizationRowId: string;
  authorizationId: string;
  authorizationVersion: number;
  accountId: string;
  productId: string;           // P1
  subscriptionId: string;
  productTenantId: string | null;
  correlationId: string;
  environmentSlot: ProvisioningEnvironmentSlot;
  entitlementSnapshotReference: string;
  entitlementVersion: string | null; // from stored auth when joined
  payloadDigest: string | null;
  expiresAt: Date | null;
  revocationStatus: string;
  verificationStatus: string;
  decision: string;
};

getPlacementReadyRequest(requestId: string): Promise<PlacementReadyAuthorizationView | null>;
```

Semantics:

- Returns non-null **only** if request is `ACCEPTED`, authorization `decision=ALLOW`, `verificationStatus=VERIFIED`, `revocationStatus=NOT_REVOKED`, and not expired.
- Otherwise null or typed reject reason — fail-closed.

Impl can compose `ProvisioningRepositoryPort` reads; keep write APIs on a separate `PlacementRepositoryPort`.

---

## 9. Proposed P7.3 data model (concrete names)

### 9.1 Scope statement

**BUILD:** capacity pools, placement policies, placement decisions (+ rationale), reservations, history, APIs, console.  
**DO NOT BUILD:** tenant DB create, Keycloak realm/org create, BB live calls, workflow engine, marking tenants ACTIVE.

Placement produces a **durable decision / assignment intent** consumable by P7.4+, not infra side-effects.

### 9.2 Tables (migration `098`)

| Table | Purpose |
|-------|---------|
| `edge_p7_capacity_pools` | Capacity inventory bound to platform/environment |
| `edge_p7_capacity_reservations` | Soft/hard holds against a pool for a request/decision |
| `edge_p7_placement_policies` | Versioned deterministic policy documents |
| `edge_p7_placement_decisions` | Decision records for a provisioning request |
| `edge_p7_placement_decision_history` | Append-only transitions |

Optional later (same epic if needed): `edge_p7_tenant_runtime_assignments` (versioned tenant↔runtime+slot link per OQ-03) — only as **declared assignment**, not provisioning execution.

### 9.3 Proposed enums

```ts
// domain/placement/placement.types.ts
export enum CapacityPoolStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SATURATED = 'SATURATED',
  SUSPENDED = 'SUSPENDED',
  RETIRED = 'RETIRED',
}

export enum CapacityReservationStatus {
  HELD = 'HELD',
  COMMITTED = 'COMMITTED',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED',
}

export enum PlacementDecisionStatus {
  PROPOSED = 'PROPOSED',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUPERSEDED = 'SUPERSEDED',
  CANCELLED = 'CANCELLED',
}

export enum PlacementDecisionOutcome {
  PLACE = 'PLACE',
  REJECT = 'REJECT',
  DEFER_REVIEW = 'DEFER_REVIEW',
}
```

### 9.4 Column sketches (precise enough to implement)

#### `edge_p7_capacity_pools`

- `id UUID PK`
- `code VARCHAR(64) UNIQUE`
- `name VARCHAR(255)`
- `platform_id UUID NOT NULL REFERENCES edge_p7_product_platforms(id)`
- `environment_id UUID NOT NULL REFERENCES edge_p7_runtime_environments(id)`
- `profile_code VARCHAR(64)` (optional align with `DeploymentProfileCode`)
- `pool_status` CHECK ∈ CapacityPoolStatus
- `total_units INTEGER NOT NULL CHECK (total_units >= 0)`
- `reserved_units INTEGER NOT NULL DEFAULT 0`
- `committed_units INTEGER NOT NULL DEFAULT 0`
- `unit_kind VARCHAR(64) NOT NULL` (e.g. `TENANT_SLOT`)
- `constraints JSONB NOT NULL DEFAULT '{}'`
- `metadata JSONB`, `version INTEGER`, audit columns

CHECK: `reserved_units + committed_units <= total_units`

#### `edge_p7_placement_policies`

- `id`, `code UNIQUE`, `policy_version INTEGER`
- `status` (DRAFT/ACTIVE/DEPRECATED)
- `rules JSONB NOT NULL` (deterministic rule ids / weights / hard gates)
- `require_compatibility_result VARCHAR(32) NOT NULL DEFAULT 'COMPATIBLE'`
- `metadata`, audit columns
- UNIQUE `(code, policy_version)`

#### `edge_p7_placement_decisions`

- `id UUID PK`
- `request_id UUID NOT NULL REFERENCES edge_p7_provisioning_requests(id)`
- `authorization_row_id UUID NOT NULL REFERENCES edge_provisioning_authorizations(id)`
- `authorization_id UUID NOT NULL`, `authorization_version INTEGER NOT NULL`
- `correlation_id UUID NOT NULL`
- `product_id UUID NOT NULL`
- `product_registry_id UUID REFERENCES edge_p7_product_registry(id)`
- `technical_version_id UUID REFERENCES edge_p7_product_technical_versions(id)`
- `platform_id UUID REFERENCES edge_p7_product_platforms(id)`
- `environment_id UUID REFERENCES edge_p7_runtime_environments(id)`
- `profile_id UUID REFERENCES edge_p7_deployment_profiles(id)`
- `contract_id UUID REFERENCES edge_p7_product_control_contracts(id)`
- `compatibility_evaluation_id UUID REFERENCES edge_p7_compatibility_evaluations(id)`
- `compatibility_result VARCHAR(32)` CHECK ∈ COMPATIBLE/INCOMPATIBLE/REQUIRES_REVIEW
- `capacity_pool_id UUID REFERENCES edge_p7_capacity_pools(id)`
- `policy_id UUID REFERENCES edge_p7_placement_policies(id)`
- `policy_version INTEGER`
- `decision_status` CHECK ∈ PlacementDecisionStatus
- `outcome` CHECK ∈ PlacementDecisionOutcome
- `rationale JSONB NOT NULL DEFAULT '[]'` (structured reasons)
- `examined_refs JSONB NOT NULL DEFAULT '{}'`
- `environment_slot VARCHAR(32) NOT NULL`
- `idempotency_key VARCHAR(255) UNIQUE`
- actor / timestamps

UNIQUE recommended: one non-superseded decision per `(request_id)` or explicit supersession chain.

#### `edge_p7_capacity_reservations`

- `id`, `pool_id`, `decision_id`, `request_id`
- `units INTEGER NOT NULL CHECK (units > 0)`
- `status` ∈ HELD/COMMITTED/RELEASED/EXPIRED
- `held_until TIMESTAMPTZ`, audit columns

#### `edge_p7_placement_decision_history`

- Mirror style of `edge_p7_provisioning_request_history` / `edge_p7_registry_history`.

---

## 10. Proposed file paths (follow existing conventions)

### Backend

| Concern | Path |
|---------|------|
| Migration | `migrations/control-plane/098_edge_p7_placement_capacity_management.sql` |
| Domain types | `src/modules/edge/domain/placement/placement.types.ts` |
| Policy / engine | `src/modules/edge/domain/placement/placement-policy-engine.ts` (+ `.spec.ts`) |
| Events | `src/modules/edge/domain/placement/placement.events.ts` |
| Write port | `src/modules/edge/domain/placement/placement-repository.port.ts` (`PLACEMENT_REPOSITORY_PORT`) |
| Auth view port | `src/modules/edge/domain/placement/placement-authorization-view.port.ts` |
| Use-cases | `src/modules/edge/application/placement/placement.use-cases.ts` |
| PG repo | `src/modules/edge/infrastructure/placement/pg-placement.repository.ts` |
| Auth view adapter | `src/modules/edge/infrastructure/placement/pg-placement-authorization-view.ts` |
| Controller | `src/modules/edge/presentation/controllers/placement.controller.ts` → `@Controller('edge/placement')` |
| DTOs | `src/modules/edge/presentation/dto/placement.dto.ts` |
| Providers wiring | `src/modules/edge/infrastructure/edge-application.providers.ts` |
| Migration check | `scripts/check-placement-migrations.ts` |
| Integration test | `test/integration/edge-placement-transactional.spec.ts` |
| Docs (this pack) | `docs/edge/p7/p7.3-placement-capacity-management/` |

### Frontend

| Concern | Path |
|---------|------|
| Nav | `components/edge/edge-shell.tsx` (`PLATFORM_NAV`) |
| Hub page | `app/(edge-console)/edge/provisioning/capacity/page.tsx` |
| Shared UI | `components/edge/placement/*` |
| API helpers | `lib/edge/placement.ts` |
| Types | `types/edge-placement.ts` |
| Tests | colocated `*.test.tsx` |

### Event type naming (align P7.2)

- `p7.placement.decision.proposed.v1`
- `p7.placement.decision.approved.v1`
- `p7.placement.decision.rejected.v1`
- `p7.capacity.pool.updated.v1`
- `p7.capacity.reservation.held.v1` / `.released.v1`

Audit `eventType`s: `placement.decision.*`, `capacity.pool.*` (mirror `registry.compatibility.evaluated`).

---

## 11. Placement engine design sketch (P7.3.02)

**Input:**

1. `PlacementReadyAuthorizationView` (from P7.1 typed view port)
2. Candidate registry tuple OR prior `CompatibilityEvaluation`
3. Active `PlacementPolicy`
4. Candidate `CapacityPool`s (same platform/environment, ACTIVE, headroom)

**Algorithm (deterministic, fail-closed):**

1. Gate commercial: ALLOW + VERIFIED + NOT_REVOKED + not expired + request ACCEPTED.
2. Resolve/evaluate compatibility via `evaluateRegistryCompatibility` (REUSE P7.2 engine — do not fork).
3. If `INCOMPATIBLE` → decision `REJECTED` / outcome `REJECT`.
4. If `REQUIRES_REVIEW` → decision `REQUIRES_REVIEW` / outcome `DEFER_REVIEW` (no auto-reserve unless policy explicitly allows — default deny auto).
5. If `COMPATIBLE` → filter pools by constraints + headroom; apply policy ranking; hold reservation; emit `PROPOSED` or auto-`APPROVED` per policy flag.
6. Persist decision + rationale (`rulesApplied`, `reasons`, pool choice, examined refs) in one TX with audit + outbox (P7.2 pattern).

**Hard rule:** empty candidate pools ≠ invent capacity. Saturation → `REQUIRES_REVIEW` or `REJECT` per policy, never silent overcommit.

---

## 12. API surface (proposed)

Base: `/api/v1/edge/placement` (or `/edge/capacity` + `/edge/placement` split — prefer single controller `edge/placement` with `/pools` subroutes to match registry style).

| Method | Path | Permission |
|--------|------|------------|
| GET | `/pools` | `platform:capacity_pools:read` |
| POST | `/pools` | `platform:capacity_pools:manage` |
| PATCH | `/pools/:id` | `platform:capacity_pools:manage` |
| GET | `/policies` | `platform:placement_policies:read` |
| POST | `/policies` | `platform:placement_policies:manage` |
| GET | `/decisions` | `platform:placement_decisions:read` |
| GET | `/decisions/:id` | `platform:placement_decisions:read` |
| POST | `/decisions/evaluate` | `platform:placement_decisions:decide` |
| POST | `/decisions/:id/approve` | `platform:placement_decisions:decide` |
| POST | `/decisions/:id/reject` | `platform:placement_decisions:decide` |
| GET | `/decisions/:id/history` | `platform:placement_history:read` |

Body DTOs: whitelist-only; evaluate requires `requestId` + registry refs (or `compatibilityEvaluationId`) + `idempotencyKey`.

---

## 13. REUSE / EXTEND / BUILD matrix (P7.3)

| Capability | Decision | Evidence |
|------------|----------|----------|
| P7.1 auth + request ids | **REUSE** | `StoredProvisioningAuthorization`, `ProvisioningRequestProps` |
| Placement-ready typed view | **EXTEND** | New `PlacementAuthorizationViewPort` |
| P7.2 registry + compatibility engine | **REUSE** | `RegistryRepositoryPort`, `evaluateRegistryCompatibility` |
| Outbox + audit TX pattern | **REUSE** | P7.2 `runWithOutbox` + `audit.create(_, client)` |
| Edge auth / permissions tables | **EXTEND** | Seed new `platform:capacity_*` / `platform:placement_*` |
| Capacity pools / decisions | **BUILD** | New tables + domain |
| Workflow / infra / KC | **DO NOT BUILD** | P7.4+ |

---

## 14. Implementation backlog mapping

From `P7.0.17_IMPLEMENTATION_BACKLOG.md`:

| ID | Task | Maps to |
|----|------|---------|
| P7.3.01 | CapacityPool | `edge_p7_capacity_pools` + reservations + APIs + UI tab |
| P7.3.02 | PlacementPolicy engine + rationale | `placement-policy-engine.ts` + `edge_p7_placement_policies` / `_decisions` |

Suggested delivery order:

1. Docs freeze (this file) → acceptance criteria
2. Migration `098` + permission seeds + check script
3. Domain types + ports + PG repos
4. Policy engine + unit tests (COMPATIBLE / INCOMPATIBLE / REQUIRES_REVIEW paths)
5. Use-cases with P7.2 TX/audit/outbox pattern
6. Controller + DTOs + OpenAPI
7. FE nav + capacity hub
8. Integration transactional test
9. Security / acceptance notes (mirror P7.2 pack numbering)

---

## 15. Non-goals / guardrails

- Do not treat `ACCEPTED` request as tenant ACTIVE / PROVISIONING / READY.
- Do not create Identity `tenants`, DBs, Keycloak realms, or BB resources.
- Do not duplicate P1 commercial catalog; only reference `product_id` and P7.2 registry ids.
- Do not auto-place on `REQUIRES_REVIEW` or empty allowlists.
- Do not start P7.4 workflow code under this epic.
- Prefer binding an existing `compatibility_evaluation_id` or re-running the **same** P7.2 engine — no parallel compatibility semantics.

---

## 16. Open questions for implementation kickoff (non-blocking for this doc)

1. Auto-approve on `COMPATIBLE` vs always `PROPOSED` pending operator approve for PRODUCTION.
2. Whether `098` includes `edge_p7_tenant_runtime_assignments` now or defers to a thin follow-up migration.
3. Reservation TTL defaults and reclaim job ownership (in-process vs later worker).
4. Whether to remediate P7.1 accept-path TX atomicity in the same PR train or separately.

---

## 17. Inspection verdict

| Area | Ready for P7.3? |
|------|-----------------|
| Branches / HEAD | Yes — `feature/console` both repos |
| P7.2 registry + compat | Yes — consume as read-only placement input |
| P7.1 auth/request refs | Yes — commercial/trust immutable fields listed above |
| Typed placement input port | **Missing** — must EXTEND |
| Capacity / placement schema | **Absent** — BUILD via `098` |
| TX/audit/outbox pattern | Yes — copy P7.2 remediation, not P7.1 split |
| FE nav hook | Yes — after Registry Management → `/edge/provisioning/capacity` |
| DTO/ValidationPipe | Yes — copy registry DTO conventions |

**Conclusion:** P7.3 can start from this baseline. First code artifacts should be `098` migration + `domain/placement/*` + `PlacementAuthorizationViewPort`, with zero infra side-effects.
