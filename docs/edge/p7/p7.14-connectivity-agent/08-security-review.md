# P7.14 — Security Review

- RBAC: `platform:agents:read|manage|command|revoke|history:read`
- No plaintext private/public keys in API bodies beyond vault refs
- Anti-replay nonce uniqueness enforced at DB + policy
- Revocation clears in-flight commands
- Compensation → WAITING_APPROVAL (no silent re-enable)
- Audit events: `p7.agent.created`, `p7.agent.register.requested`, `p7.agent.command.created`, `p7.agent.command.requested`, `p7.agent.revoke.requested`
- Addresses deferred SR-08 (agent command replay) from P7.0 security register
