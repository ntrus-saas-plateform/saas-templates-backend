# Open Questions Evidence Index

| OQ | Topic | Status | Decision summary |
|----|-------|--------|------------------|
| OQ-01 | Asymmetric signature vs digest+S2S | **ACCEPTED** | Option C: S2S + digest + asymmetric signature (prod) |
| OQ-02 | Post-termination reuse | **ACCEPTED** | Conditional reuse, never automatic |
| OQ-03 | Multi environment_slot | **ACCEPTED** | One PROD default; extras via P5 entitlements |
| OQ-04 | Sync revoke when P5 down (+ races) | **ACCEPTED** | Sync verify, fail-closed, 2s timeout |
| OQ-05 | Deprecate provisioning.requested.v1 | **ACCEPTED** | Temporary dual-consume + explicit mapping |
| OQ-06 | Account transfer (NEW) | **DEFERRED_POST_G1** | Out of P7.1; reopen before transfer feature |

Source: `17-OQ-TECHNICAL-DECISION-PACKAGE.md` (2026-11-10 human requestor).
