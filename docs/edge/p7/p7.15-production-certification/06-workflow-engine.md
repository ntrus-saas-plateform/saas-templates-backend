# P7.15 — Workflow Engine

| Definition | Steps |
|------------|-------|
| `p715.certification.assemble` | revalidate_auth → assemble_manifest → collect_evidence → evaluate_gates → verify |
| `p715.certification.certify` | revalidate_auth → evaluate_gates → apply_certify → verify |
| `p715.certification.revoke` | revalidate_auth → apply_revoke → verify |

Live executor: Nest **11th** `CERTIFICATION_LIVE_EXECUTOR` (after P7.14 `AGENT_LIVE_EXECUTOR`). Handlers never simulate success when executor absent.
