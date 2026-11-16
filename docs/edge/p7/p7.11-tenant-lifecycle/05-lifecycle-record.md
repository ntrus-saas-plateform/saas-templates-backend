# P7.11 — Lifecycle Record

## Create

`CreateLifecycleRecordUseCase`:

1. Load Activation Record by id — must be `ACTIVE` (else `ACTIVATION_NOT_ACTIVE`).
2. Revalidate bound P7.1 authorization (fail-closed).
3. Reject if an active (non-terminal) lifecycle already exists for tenant×product.
4. Create record with `lifecycleStatus=ACTIVE`, `deletionProtection=true`, bind auth + activation ids.
5. Audit + history.

## Reads

List / get with optional runs + evidence. History permission for runs/evidence endpoints.
