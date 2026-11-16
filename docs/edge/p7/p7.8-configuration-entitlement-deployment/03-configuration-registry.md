# P7.8 — Configuration Registry

## Registry objects

1. **Schemas** — authoritative JSON Schema versions; checksum over canonical JSON.
2. **Templates** — product/runtime-oriented payloads bound to a schema; publish freezes a version.
3. **Bundles** — composition of template version refs (+ dependency refs); only **PUBLISHED** bundles may be assigned.

## Lifecycle rules

- Create schema / template / bundle requires `platform:configuration:manage`.
- Publish template/bundle uses optimistic concurrency (`expectedVersion`).
- Published versions are immutable; supersede via new version numbers.
- Assignment requires a published bundle version and a P7.1 `provisioningRequestId`.

## Checksums

`checksumPayload` (SHA-256 over sorted-key canonical JSON) is stored on schemas, template versions, bundle versions, and applied assignment state. Deploy verification compares expected vs applied digests.

## Assignment fields of interest

| Field | Meaning |
|-------|---------|
| `desiredConfig` / `appliedConfig` | Wanted vs last successfully applied (secrets vault-ref only) |
| `entitlementSnapshotRef` / `entitlementVersion` | P5 snapshot identity |
| `driftStatus` | Result of reconcile |
| `workflowId` | Active / last P7.4 workflow |

## Console mapping

Edge console tabs: Schemas | Templates | Bundles | Tenant Assignments | History — read gated by `platform:configuration:read` (history by `…:history:read`).
