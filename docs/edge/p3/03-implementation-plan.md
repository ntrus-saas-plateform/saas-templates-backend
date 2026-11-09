# P3 Implementation Plan

## Increment 1 (delivered) — Foundation

- P3.0 audit + reuse matrix
- Migration `077_edge_marketing_foundation`
- Domain invariants (campaign lifecycle, commercial gates, consent, scoring)
- APIs under `/api/v1/edge/marketing/**`
- Public form submission (`@Public` + FE `/api/marketing-public/...`)
- Console hub `/edge/marketing`
- Unit + DB + Playwright smoke

## Increment 2 (delivered) — Orchestration depth

- Migration `078_edge_marketing_orchestration`
- Content approve/publish + landing CRUD/publish
- Channel registry + delivery request/receipt (no fake success)
- Journey create/activate/execute (deterministic)
- Attribution First/Last/Linear/Position + performance snapshots
- Console tabs for content/landing/channels/journeys/attribution

## Increment 3 (delivered) — Ops hardening

- Migration `079_edge_marketing_ops_hardening`
- Channel adapter port + Unavailable adapter (no fake DELIVERED)
- Frequency caps on send
- Journey WAIT schedules + resume API/UI
- Lead assign + merge
- Public form throttle (Nest + FE proxy)
- Analytics snapshot create/list in console

## Increment 4 (delivered) — Providers & qualification

- Channel adapter modes: `unavailable` | `logging_accepted` | `http_webhook` | `resend` | `auto`
- Journey WAIT worker (leader-locked poller, env-gated)
- Analytics summary API + CAC honesty gate (`revenueReconciled`)
- Public form rate-limit smoke + form/tenant invariant tests

## Increment 5a (delivered) — Resend EMAIL

- Resend adapter — ACCEPTED only
- Svix webhook receipts
- Correlation via tags `delivery_attempt_id` + `email_id`

## Increment 5b (delivered) — Studio & WhatsApp

- Studio block schema v1 + PUT studio APIs + console editor
- Meta WhatsApp marketing adapter + signed webhooks
- Playwright marketing A–F (CSRF + auth-gated UI)

## Increment 5c / finalize (delivered)

- Studio drag-drop + markdown preview + reorder
- Analytics honesty panel (CAC/ROAS/LTV UNAVAILABLE until revenue SoT)
- Edge e2e seed pack (`pnpm seed:edge-e2e` + Keycloak `edge-e2e` user)
- Provider contract unit tests; migrations through `080`

## Out of default CI (honest / gated)

- Live Resend/Meta sandbox e2e (requires secrets + public webhook URL)
- Full TipTap/ProseMirror WYSIWYG (block studio is the shipped composer)
- Authenticated A–F in CI only when Keycloak + seed:edge-e2e are available
