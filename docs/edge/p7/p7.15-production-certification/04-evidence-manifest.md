# P7.15 — Evidence Manifest

## Assemble seeds

`defaultEvidenceKeySpecs()` writes:

1. Ten required Shared SaaS keys (P7.1 auth through P7.13 reconciliation).
2. `p714_agents` as **optional** (visible in viewer, not blocking).

## Item lifecycle

`MISSING` → attach/verify → `ATTACHED` / `VERIFIED` (or `FAILED` / `WAIVED`).

Gate evaluation reads current items; blocking list drives `READY` vs `FAILED` after assemble, and deny for certify.

## Cross-cutting Evidence viewer

FE route `/edge/provisioning/evidence` lists certification packages + links to certification detail. Does not invent ACCEPTED.
