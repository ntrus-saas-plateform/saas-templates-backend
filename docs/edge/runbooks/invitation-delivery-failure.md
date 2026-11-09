# Runbook — Edge invitation delivery failure

## Symptoms
- Invitation created but email not received.
- `delivery_status` indicates failure; workflow remains recoverable.

## Actions
1. Confirm invitation row exists with hashed token (never log raw token).
2. Check `MAIL_PROVIDER` / SMTP / Resend configuration (shared infra, Edge templates).
3. Use `POST /api/v1/edge/administrators/invitations/:id/resend` when authorized.
4. If Keycloak user provisioning pending, leave workflow in pending — do not mark ACTIVE.

## Security
- Rate-limit resend; do not expose tokens in notifications or API error bodies.
