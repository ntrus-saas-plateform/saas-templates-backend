# P7.14 — Command Integrity

- Signed command envelope (`signature_ref` vault).
- Unique nonce + command id; DB unique constraint `(agent_id, nonce)`.
- Tenant / agent binding in workflow snapshot.
- Expiration respected; expired commands must not execute blindly after reconnect.
- Allowlisted `commandType` only (no arbitrary shell).
- Payload stored as vault `payload_ref` — not inline secrets.
