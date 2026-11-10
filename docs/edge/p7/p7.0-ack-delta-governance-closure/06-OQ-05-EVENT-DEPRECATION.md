# 06 — OQ-05 Event Deprecation Timeline

| OQ ID | OQ-05 |
| Title | Timeline for deprecating `subscription.provisioning.requested.v1` |
| Status | **ACCEPTED** |
| Priority | P1 NON_BLOCKING Gate A (with transitional mapping) |
| Final Decision | Temporary dual-consume with explicit mapping |
| Decision record | `17-OQ-TECHNICAL-DECISION-PACKAGE.md` (2026-11-10) |

## Final Decision — ACCEPTED

1. P7.1 **dual-consume** legacy + canonical events with **explicit mapping**  
2. Reject insufficient legacy payloads (legacy is **not** a full P5 authorization)  
3. P5 issues `subscription.provisioning.authorization.issued.v1` (and related C-09 names)  
4. Deprecate legacy after ≥1 minor dual-support window  
5. Document via P7.1.07  

**Evidence:** `subscription.events.ts` VERIFIED_IN_CODE; not full auth.  
**Approver roles still needed for C-09 / Gate A countersign:** P5 Domain Owner, P7 Domain Architect (and Gate A role set).
