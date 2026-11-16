# P7.14 — Workflow Engine Integration

| Definition | Steps |
|------------|-------|
| `p714.agent.register` | revalidate_auth → validate_outbound → validate_public_key_ref → persist_registration → activate → verify |
| `p714.agent.command` | revalidate_auth → validate_nonce → enqueue_command → spool_command → verify |
| `p714.agent.revoke` | revalidate_auth → mark_revoking → revoke_pending_commands → revoke_agent → verify |

Handlers registered via Nest **10th** `AGENT_LIVE_EXECUTOR`. Absent executor ⇒ FAIL (never simulate success). Compensation ⇒ WAITING_APPROVAL.
