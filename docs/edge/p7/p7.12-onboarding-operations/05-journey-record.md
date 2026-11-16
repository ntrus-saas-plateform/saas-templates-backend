# P7.12 — Journey Record

`OnboardingJourney` is the SoT for operational onboarding status.

## Binding requirements

- `activation_record_id` → P7.10 Activation Record (must be ACTIVE at create / start)
- `authorization_row_id` + `authorization_version` → P7.1 trust material (revalidated fail-closed)
- `provisioning_request_id` carried for revalidation context
- Optional `template_id` → must be PUBLISHED when provided

## Fields of note

- `current_step_key` — last advanced / waiting step
- `handover_evidence_ref` — vault-style ref only
- `workflow_id` — last launched P7.4 instance
- Unique active journey per `(tenant_id, product_id)` where status not CLOSED/CANCELLED/SUPERSEDED

Create does **not** start the workflow; `RequestOnboardingStartUseCase` launches `p712.onboarding.start`.
