# P7.14 — Failure & Recovery

| Failure | Behavior |
|---------|----------|
| Missing live executor | Handler FAIL (never simulate success) |
| Nonce replay | `NONCE_REPLAY` — reject |
| Plaintext key | `PLAINTEXT_KEY_FORBIDDEN` |
| outboundOnly false | `OUTBOUND_ONLY_REQUIRED` |
| Auth bound + invalid P7.1 | `AUTHORIZATION_FAILED` fail-closed |
| Agent disconnected | Command remains in spool PENDING; no blind execute of expired cmds |
| Already REVOKED revoke | CONFLICT — create new agent_code |
