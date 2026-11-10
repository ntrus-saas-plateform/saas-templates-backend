# 05 — Authorization Revocation Model (DELTA-04)

| Document ID | P7.0-ACK-DELTA-05 | Decision | **D-REV-01 Hybrid** |

## Separate state machines (never merge)

| Machine | Owner | SoT |
|---------|-------|-----|
| Authorization Lifecycle | P5 | P5 |
| Provisioning Request Lifecycle | P7 | P7 |
| Workflow Execution (future) | P7.4 | P7.4 |

P7 cancel ≠ P5 revoke. P5 revoke ≠ automatic data destruction.

## Mechanism: Hybrid

| Path | Use |
|------|-----|
| A. Revocation event (reliable outbox) | Fast propagation |
| B. Sync status query | Before sensitive ops / when event lag suspected |
| C. Hybrid | **Selected** — events + sync verify at request accept and before future activation |

## Authorization states (P5)

`DRAFT → ISSUED → ACTIVE → {REVOKED | EXPIRED | SUPERSEDED}`  
Monotonic `authorization_version` / `revocation_version` (higher wins; ignore stale).

## Request states (P7) — see also doc 06

`RECEIVED → ACCEPTED | REJECTED → {CANCELLED | SUPERSEDED_BY_REVOKE | QUEUED_FOR_WORKFLOW*}`  
\*QUEUED only after P7.4 authorized — not in P7.1 execution.

On revoke:

| Request state | Action |
|---------------|--------|
| Not yet accepted | Reject / mark revoked |
| Accepted, no workflow | Transition `SUPERSEDED_BY_REVOKE`; no start |
| Future in-flight workflow | Stop new steps; compensate per lifecycle policy — **no blind delete** |
| After technical activation | Do **not** auto-destroy; require lifecycle op (suspend/decommission) with its own auth |

## Delivery failure matrix

| Case | Behavior |
|------|----------|
| Lost/delayed/dup/out-of-order revoke | Version monotonicity + reconciliation job |
| P5 down | Fail-closed for new starts; sync verify fails → deny |
| P7 down | Events durable in outbox/inbox; process on recovery |
| Replay old revoke | Ignore if already applied higher version |
| Reissue after revoke | New authorization_id or new version with explicit REISSUED; never reuse revoked |

## Required tests (for C-03 / C-09)

All 17 scenarios in mission §6.4 — documented as required; **NOT_IMPLEMENTED** until P7.1/P5 work.
