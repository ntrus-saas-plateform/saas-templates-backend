# P7.13 — Failure & Recovery

| Failure | Handling |
|---------|----------|
| P7.1 deny / timeout (when bound) | Fail-closed; evidence recorded; run not advanced |
| Provider unreachable | `UNKNOWN` findings; quarantine or re-observe |
| Unsafe auto-remediate | `WAITING_APPROVAL`; code `UNSAFE_AUTO_REMEDIATE` |
| Expired waiver | Ignored; code `WAIVER_EXPIRED` if asserted |
| Lease invalid | Fail with `AUTHORIZATION_FAILED` |
| Execute without approval when ineligible | Stay `WAITING_APPROVAL` |

## Recovery actions

1. Re-observe after provider recovery.
2. Quarantine UNKNOWN findings.
3. Approve reversible remediations.
4. Create time-bounded waivers (future `expiresAt` only).
