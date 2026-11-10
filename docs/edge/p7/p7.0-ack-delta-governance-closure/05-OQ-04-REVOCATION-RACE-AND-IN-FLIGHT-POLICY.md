# 05 — OQ-04 Revocation Sync Path / Races / In-Flight Policy

| OQ ID | OQ-04 |
| Title | Sync revoke API path/SLA when P5 down during accept? |
| Status | **ACCEPTED** |
| Priority | P0 BLOCKING Gate A |
| Final Decision | Sync verify + fail-closed if P5 unavailable; timeout **2s** (default DENY) |
| Decision record | `17-OQ-TECHNICAL-DECISION-PACKAGE.md` (2026-11-10) |
| Scope note | Extends original OQ-04 with race/in-flight policy required by D-REV-01 — **same ID** |

## Sync path when P5 down (core OQ)

| Moment | Policy |
|--------|--------|
| Accepting new Provisioning Request | **Fail-closed** if sync verify required and P5 unavailable |
| Event-only lag | Local revoke cache + eventual sync; do not start if status unknown |
| SLA (**ACCEPTED**) | Sync verify timeout **≤ 2s**; on timeout → **DENY** start (configurable but default deny) |

No implicit allow on P5 outage.

## Race / in-flight matrix (summary)

| Scenario | Policy |
|----------|--------|
| Revoke before request | Reject create |
| During create TX | TX sees revoke version or post-commit mark SUPERSEDED_BY_REVOKE |
| After commit, before workflow | Block workflow start |
| During compensable step (future) | Stop + compensate |
| During irreversible step (future) | Complete safe halt; human task; **no auto-delete** |
| After DB/realm create (future) | Lifecycle suspend/decommission auth required |
| After activation | Revoke ≠ destroy; commercial/tech lifecycle ops |
| Delayed/dup/out-of-order revoke | Monotonic revocation_version |
| Lost event | Reconciliation + sync before sensitive ops |

## Linearization (realistic)

Local TX + unique keys + outbox/inbox + version counters + sync verify. **No** global P5/P7 atomicity claim.

## Approvers

Security · P5 · P7 · Engineering Lead

## Acceptance criteria

Fail-closed on P5 down · SLA documented · race matrix approved · irreversible vs compensable split · no auto-purge on revoke.
