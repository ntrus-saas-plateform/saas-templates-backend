# Okapi Edge — P7 Tenant Provisioning

## Authoritative governance

| Pack | Role |
|------|------|
| [`p7.0-ack-delta-governance-closure/`](./p7.0-ack-delta-governance-closure/README.md) | OQ + Gate A/B; signature pack `18` |
| [`p7.0-ack-delta-architecture-clarification/`](./p7.0-ack-delta-architecture-clarification/README.md) | Architecture Delta `1.0.0` |
| [`p7.0-ack-architecture-freeze/`](./p7.0-ack-architecture-freeze/README.md) | Parent ACK / freeze `1.0.0-freeze` |
| [`p7.0-repository-audit/`](./p7.0-repository-audit/README.md) | Evidence baseline |

## P7.1 deliverables

| Doc | Status |
|-----|--------|
| [GATE-A verification](./P7.1-GATE-A-PREIMPLEMENTATION-VERIFICATION.md) | `GATE_A_PENDING_HUMAN_APPROVAL` |
| [Signature pack 18](./p7.0-ack-delta-governance-closure/18-P7-1-GATE-A-SIGNATURE-AND-AUTHORIZATION-PACK.md) | NOT EFFECTIVE |
| [Mapping](./P7.1-REPOSITORY-IMPLEMENTATION-MAPPING.md) | DONE |
| [Technical design](./P7.1-TECHNICAL-DESIGN.md) | DONE |
| [Implementation report](./P7.1-IMPLEMENTATION-REPORT.md) | COMPLETE WITH EXTERNAL BLOCKERS |
| [Test execution](./P7.1-TEST-EXECUTION-REPORT.md) | DONE |
| [Security](./P7.1-SECURITY-VERIFICATION-REPORT.md) | DONE |
| [Migration](./P7.1-DATABASE-MIGRATION-REPORT.md) | SQL ready |
| [Zero side effects](./P7.1-ZERO-SIDE-EFFECTS-REPORT.md) | DONE |
| [Event alignment](./P7.1-EVENT-ALIGNMENT.md) | DONE |
| [G1 evidence index](./P7.1-G1-EVIDENCE-INDEX.md) | DONE |
| [G1 submission](./P7.1-G1-ACCEPTANCE-SUBMISSION.md) | `G1_PENDING_EVIDENCE` |
| [Final execution](./P7.1-FINAL-EXECUTION-REPORT.md) | COMPLETE WITH EXTERNAL BLOCKERS |

**Runtime:** `EDGE_P7_PROVISIONING_ADAPTER` default `unavailable`. Apply `095` via `npm run migrate:control` then `npm run check:provisioning:migrations`. Unit tests: `npm run test:edge:provisioning` (21 passed).

## Flat drafts (superseded)

Files `P7.0.*` and `00`–`10-gate-g0` in this directory are working copies. Use the structured packs above for gates.
