# P7.7 — Reconciliation

**Code:** `keycloak.reconcile_topology` (live executor), `ProvidedReconciliationAssessment.classify`, `edge_p7_keycloak_reconciliation_runs`.

## Reconcile-before-create (provisioning side)

Every adapter mutation starts with an existence probe against the registered origin:

| Operation | Probe | On conflict |
|-----------|-------|-------------|
| Realm | `realmExists` (GET realm) | 409 ⇒ re-probe, adopt winner |
| Organization | `organizationExists` (GET `?bc=`) | 409 ⇒ re-probe, adopt |
| Client | `clientExists` (GET `?clientId=`) | 409 ⇒ re-probe, adopt; **no secret re-issue** |

Result: a network error after a create never causes a blind second create. Re-runs re-adopt existing resources and record `preexisting` evidence.

## Resource references

`edge_p7_keycloak_resource_references` binds internal ↔ external identity per resource:

| Field | Meaning |
|-------|---------|
| `resource_kind` | `REALM` \| `ORGANIZATION` \| `CLIENT` \| `OIDC_CONFIGURATION` \| `SERVER` |
| `internal_ref` | Edge UUID (row id) — never replaced by an external id |
| `external_id` | Keycloak id (or name when id unavailable) |
| `verified` / `verified_at` | Set when the binding was observed on the server |

Unique constraint `(resource_kind, internal_ref, external_id)` makes re-binding idempotent (executor tolerates the violation).

## Reconciliation runs

Triggered by `POST /edge/keycloak/topologies/:id/reconcile` → P7.4 workflow (`keycloak.reconcile_topology` step, `trigger = WORKFLOW`; manual/scheduled/drift triggers are schema-supported).

Procedure:

1. `realmExists` for the topology's realm.
2. `clientExists` for **every** declared client.
3. `organizationExists` for Model B topologies only (probe on stored alias).
4. Persist a run row with `observed_state` (realm presence, fingerprint, per-client existence, org presence).
5. Classify drift: `REALM_MISSING` / `CLIENTS_MISSING` / `ORGANIZATION_MISSING`.

### Outcome mapping

| Observation | Run outcome | Topology status | Step result |
|-------------|-------------|-----------------|-------------|
| No drift | `NO_DRIFT` | last-reconciliation stamp (or `DEGRADED → READY`) | `SUCCEEDED` |
| Clients/org missing (realm present) | `REMEDIATED` | `RECONCILIATION_REQUIRED` (reason = classification) | `FAILED` (`DRIFT_DETECTED`, retryable) |
| Realm missing (deleted outside Edge) | `QUARANTINED` | `QUARANTINED` (`realm-missing-outside-edge`) | `FAILED` (`DRIFT_DETECTED`, non-retryable) |

**Never blind:** a missing realm is quarantined — Edge does not auto-recreate or auto-delete; remediation goes through an authorized workflow. Classification levels used by the executor: `NONE` / `CONFIGURATION` / `CRITICAL` (the assessment helper also defines `REALM_MISSING`, `REALM_MODIFIED`, `ORG_MISSING`, `CLIENT_MISSING`).

## Evidence and history

| Stream | Table | Content |
|--------|-------|---------|
| Operation evidence | `edge_p7_keycloak_operation_evidence` | Per-step proof: operation, `SUCCEEDED/FAILED/SKIPPED`, redacted evidence, error code/message, duration, worker, timestamp. Persisting evidence is **mandatory** for mutations — the executor throws if evidence cannot be written. |
| Provisioning history | `edge_p7_keycloak_provisioning_history` | Immutable lifecycle trail: `CREATE`, `REGISTER`, `DISCOVER_CAPABILITIES`, `TRANSITION`, `BIND_WORKFLOW`, `LAUNCH_…` with `from_status`/`to_status`, actor, details. |
| Health checks | `edge_p7_keycloak_health_checks` | Capability discovery results (`CAPABILITY_DISCOVERY`, `HEALTHY/DEGRADED/UNHEALTHY`, latency, details). |

Read APIs: `GET …/topologies/:id/evidence`, `…/history`, `…/reconciliations` (permission `platform:keycloak:history:read` for evidence/history).

## Honest status

Reconciliation logic is covered by unit coverage (plan/handler suites), the DB integration test (run create/complete/list with drift classification) and the executed security suite. A **live** reconcile cycle against a real Keycloak server was not part of the executed matrix (`12-test-evidence.md`).
