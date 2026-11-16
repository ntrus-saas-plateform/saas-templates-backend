# P7.11 — Domain Model

## Aggregates

| Aggregate | Role |
|-----------|------|
| **TenantLifecycleRecord** | SoT for technical lifecycle status; binds P7.1 auth + P7.10 Activation Record |
| **LifecycleRun** | One SUSPEND / RESUME / DEPROVISION / MIGRATE / RECOVER / VERIFY / ARCHIVE attempt |
| **LifecycleEvidence** | Durable step-level evidence (append-only) |
| **LifecycleHistory** | Status / action history |

## Status machine (summary)

`ACTIVE → SUSPENDING → SUSPENDED → RESUMING → ACTIVE`  
`ACTIVE|SUSPENDED|FAILED|ARCHIVED → DEPROVISIONING → DEPROVISIONED` (→ `DATA_PURGED` via retention, not silent)  
Also: `MIGRATING`, `ARCHIVING`/`ARCHIVED`, `RESTORING`, `FAILED`.

`deletion_protection` defaults **TRUE**. Partial unique index: one non-terminal row per tenant×product.

## Handler keys

See `LIFECYCLE_HANDLER_KEYS` in `lifecycle.types.ts` — revalidate, require_*, mark_*, coord_*, verify.

## Error codes

`VALIDATION`, `AUTHORIZATION_FAILED`, `ACTIVATION_NOT_ACTIVE`, `LIFECYCLE_FORBIDDEN`, `DELETION_PROTECTED`, `EXPORT_EVIDENCE_REQUIRED`, `FLAGS_REQUIRED`, `CONFLICT`, `PROVIDER_UNAVAILABLE`.

## Persistence

Migration **106** (`106_edge_p7_tenant_lifecycle.sql`):

- `edge_p7_tenant_lifecycle_records`
- `edge_p7_lifecycle_runs`
- `edge_p7_lifecycle_history`
- `edge_p7_lifecycle_evidence`
