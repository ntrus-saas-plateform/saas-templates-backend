# Product Publication (P1.15)

## Preconditions

`assertPublicationAllowed` requires:

- Readiness result not BLOCKED / NOT_READY (READY or NEEDS_REVIEW per policy)
- Version in a publishable status
- Product at `READY_FOR_PUBLICATION` (or already `PUBLISHED` for re-snapshot)

## Workflow (implemented)

1. Evaluate readiness (persisted)
2. Validate preconditions
3. Publish version if `VALIDATED`
4. Create immutable `edge_publication_snapshots` JSON payload (product, version, capabilities, bindings, readiness)
5. Transition product lifecycle to `PUBLISHED`
6. Set `default_version_id`

Approval refs are accepted on the API for future SoD; full multi-party approval workflow UI is partial.

## Out of scope

Commercial offer publication, pricing, entitlements, tenant provisioning.
