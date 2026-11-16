# P7.15 — Domain Model

## Aggregates / records

| Record | Role |
|--------|------|
| `CertificationPackage` | Code/name/status; gateResults; evidenceManifest; certifiedAt/revokedAt |
| `CertificationEvidenceItem` | Per-key slot (`MISSING`/`ATTACHED`/`VERIFIED`/`FAILED`/`WAIVED`); `required` flag |
| `CertificationRun` | ASSEMBLE / CERTIFY / REVOKE / VERIFY outcomes |
| `CertificationEvidence` | Durable step outcomes |

## Package status

`DRAFT` → `ASSEMBLING` → `READY` → `CERTIFIED` → `REVOKED` (or `FAILED` on gate failure).

## Default evidence keys (Shared SaaS)

Required: `p71_auth`, `p74_workflows`, `p76_infra`, `p77_keycloak`, `p78_configuration`, `p79_experience`, `p710_activation`, `p711_lifecycle`, `p712_onboarding`, `p713_reconciliation`.

Optional: `p714_agents` (not required for Shared SaaS).

## Handler keys

`certification.revalidate_auth`, `assemble_manifest`, `collect_evidence`, `evaluate_gates`, `apply_certify`, `apply_revoke`, `verify`.
