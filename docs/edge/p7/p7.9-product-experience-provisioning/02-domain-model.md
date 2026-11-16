# P7.9 — Domain Model

## Aggregates

| Aggregate | Role |
|-----------|------|
| **ExperienceProfile** | Product-scoped experience blueprint (`code`, compatible runtimes/deployment profiles) |
| **ExperienceApplication** | Draftable application parent + immutable published versions (checksummed manifest) |
| **TenantExperienceAssignment** | Desired/applied experience for a tenant×product; P7.1 auth binding + workflow id |
| **TenantApplicationBinding** | Assignment ↔ application version link |
| **ExperienceClientRegistration** | Technical OIDC client (redirects, origins, `credential_ref`) — not business users |
| **ExperienceDomainBinding** | Hostname + ownership / DNS / TLS / route status |
| **ExperienceCertificate** | TLS certificate metadata with vault `certificate_ref` (no PEM) |
| **ExperienceDeploymentRun** | One provision / verify / domain / client / deactivate attempt |
| **ExperienceEvidence** | Durable step-level evidence (redacted) |

## Status machines (summary)

**Profile / Application:** `DRAFT → VALIDATED → PUBLISHED → DEPRECATED → RETIRED`

**Application version:** `DRAFT → VALIDATED → PUBLISHED → SUPERSEDED`

**Assignment:** `ASSIGNED → PROVISIONING → READY | FAILED`; deactivate path `DEACTIVATING → DEACTIVATED`; may become `SUPERSEDED`

**Application binding:** `PENDING → PROVISIONING → ACTIVE | FAILED`; may `REVOKED`

**Client registration:** `PENDING → ACTIVE | FAILED`; may `REVOKED`

**Domain ownership:** `PENDING → VERIFIED | FAILED`; may `REVOKED`

**TLS:** `PENDING → PROVISIONING → ACTIVE | FAILED | EXPIRED`; may `REVOKED`

**Domain binding / route:** `PENDING → ACTIVE | FAILED`; may `DEACTIVATED`

**Drift:** `NONE | DETECTED | REMEDIATING | RESOLVED | UNKNOWN` (field present; P7.9 provision path focuses on assign → provision → verify)

## Application kinds

`WEB` | `MOBILE` | `DESKTOP` | `POS` | `OPERATIONS` | `CUSTOMER` | `KIOSK` | `DISPLAY` | `DEVICE` | `OTHER`

## Client kinds

`PUBLIC` | `CONFIDENTIAL` | `SERVICE_ACCOUNT` — technical OIDC only.

## Error codes (selected)

`VALIDATION`, `AUTHORIZATION_FAILED`, `REDIRECT_URI_INVALID`, `WEB_ORIGIN_INVALID`, `DOMAIN_TAKEOVER_RISK`, `DOMAIN_OWNERSHIP_UNVERIFIED`, `HOSTNAME_CONFLICT`, `COMPATIBILITY_MISMATCH`, `PROFILE_NOT_PUBLISHED`, `APPLICATION_NOT_PUBLISHED`, `CROSS_TENANT_ROUTING`, `SECRET_PLAINTEXT_FORBIDDEN`, `PROVIDER_UNAVAILABLE`, `CONFLICT`.

## Persistence

Tables under migration **104** (`edge_p7_experience_*`, `edge_p7_tenant_experience_assignments`, `edge_p7_tenant_application_bindings`, runs, history, evidence). Permissions `platform:experience:*` seeded in the same migration.
