# 03 — OQ-02 Post-Termination Product Tenant Reuse

| OQ ID | OQ-02 |
| Title | Default policy: reuse Product Tenant after terminate vs always new? |
| Status | **ACCEPTED** |
| Priority | P0 BLOCKING Gate A |
| Final Decision | Conditional reuse — never automatic |
| Decision record | `17-OQ-TECHNICAL-DECISION-PACKAGE.md` (2026-11-10) |

## Problem

D-CARD-01 durable tenant needs explicit reuse after commercial end. Terminate ≠ purge ≠ decommission.

## Final Decision — ACCEPTED (Option B: Conditional reuse)

**Never automatic.** Eligibility engine checks ownership, product match, tenant state, retention, legal holds, debts policy (P5), technical readiness.

| Tenant State | New Subscription same product | Behavior |
|--------------|-------------------------------|----------|
| ACTIVE | Allowed | Bind new/updated association; no second active conflicting entitlement without policy |
| SUSPENDED | Conditional | Resume path preferred; new assoc after commercial clear |
| ARCHIVED | Conditional | Restore workflow (P7.11) then bind — not silent |
| DECOMMISSIONING | Deny | Wait terminal state |
| DECOMMISSIONED | Deny reuse of same id | New Product Tenant |
| DATA_PURGED | Deny | New Product Tenant |
| MIGRATING | Deny | Wait completion |

Commercial terminate → **does not** auto-destroy data. Purge = separate authorized lifecycle op.

## Matrix notes for scenarios 1–14

Renewal/plan change → same tenant.  
Re-subscribe after terminate → conditional reuse if tenant not purged.  
Account closed → no reuse until ownership rules (OQ-06).  
Product change → **never** reuse (one tenant = one product).

## Approvers

Product/Platform Owner · P5 · P7 · Principal Architect

## Acceptance criteria

Lifecycle matrix approved · retention/purge separated · P5 eligibility signals defined · no silent reactivation of CLOSED associations.
