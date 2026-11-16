# P7.14 — Connectivity Policy

## Invariants

1. **outbound_only=true** — always forced on create/update; `false` rejected (`OUTBOUND_ONLY_REQUIRED`).
2. **public_key_ref vault-only** — `vault:…` or `sec_…`; PEM/plaintext forbidden (`PLAINTEXT_KEY_FORBIDDEN`).
3. **Nonce anti-replay** — 64-char hex; unique per agent (`UNIQUE (agent_id, nonce)` → `NONCE_REPLAY`).
4. **Revoke fail-closed** — active commands (PENDING/QUEUED/DISPATCHED/ACKED) → `REVOKED`.
5. **P7.1** — when `provisioningRequestId` bound, missing/invalid auth → DENY (`AUTHORIZATION_FAILED`).

Policy functions live in `domain/connectivity-agent/connectivity-agent-policy.ts` with unit coverage.
