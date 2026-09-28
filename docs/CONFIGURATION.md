# Configuration Engine

## Resolver

`ConfigurationResolverService` (`shared/configuration/`) implements override chain (most specific wins):

1. **Session overrides** (`sessionOverrides` — ephemeral, never persisted)
2. **User settings** map (when provided in context)
3. **Organization** setting (if key is `overrideable` at org level)
4. **Tenant** setting
5. **Platform** default (`platform-defaults.ts`)

Do not collapse layers: business transactions use org/tenant values; display prefs use user/session. See [IDENTITY.md](./IDENTITY.md) §55.

Definitions and Zod validation: `modules/identity/domain/configuration/setting-definition.ts`.

**Commercial / inventory runtime policies are NOT stored primarily in this resolver.** See [CONFIGURATION-CONSOLIDATION.md](./CONFIGURATION-CONSOLIDATION.md).

## Namespaces

| Namespace | Examples |
|-----------|----------|
| `localization.*` | locale, timezone |
| `security.*` | mfaPolicy, sessionLifetimeMinutes |
| `ui.*` | theme, density |
| `notifications.*` | email toggles |
| `features.*` | invitations, keycloakSync, commercial enable_* mirrors |

Deprecated mirrors (still defined, **ignored by engines**): `commerce.allowNegativeStock`, `inventory.allowNegativeStock`, `inventory.valuationMethod`.

## Domain SoT (org)

| Store | Purpose |
|-------|---------|
| `commercial_org_config` | Reservation TTL, ATP default, allocation strategy, commercial flags, retention |
| `inventory_policies` | Negative stock, FEFO, lot/approval rules |
| `orchestration_timeout_config` | Saga + anomaly timeouts |
| Channel JSON | Overlay on org ATP/allocation |

## APIs

- `GET/PATCH /api/v1/settings/tenant/:namespace`
- `GET/PATCH /api/v1/settings/organizations/:id/:namespace`
- `GET/PUT /api/v1/commercial-config`
- `GET/PUT /api/v1/inventory/policies`
- `GET/POST /api/v1/orchestration/timeouts`

Sensitive values use `secret://` references via `SecretProviderPort`; never returned in plain text.

## Feature flags

`FeatureFlagServicePort` reads `features.*` via resolver. Writing commercial flags via `PUT /commercial-config` syncs the matching `features.*` keys. Prefer the Commercial settings UI over editing duplicate `enable_*` keys on the Features page (those keys are hidden in the catalog).

## Tests

Override chain: `src/shared/configuration/configuration-resolver.service.spec.ts`.  
Commercial runtime merge: `src/modules/commercial-shared/domain/commercial-org-runtime.spec.ts`.
