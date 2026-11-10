# P4 — Provider & Ops Runbook (e-sign, calendar, migrate, E2E)

**Date:** 2026-11-09

## 1. Control-plane migrations `081`–`086`

```bash
cd saas-templates-backend
npm run migrate:control
npm run check:sales:migrations
```

Optional Testcontainers integrity (Docker required):

```bash
TESTCONTAINERS=true npm run test:edge:sales:db
```

## 2. Electronic signature (DocuSign / HelloSign)

Default: `SALES_SIGNATURE_ADAPTER=unavailable` — honest `UNAVAILABLE`, never invents `EXECUTED`.

| Mode | Env |
|------|-----|
| Auto | `SALES_SIGNATURE_ADAPTER=auto` + DocuSign **or** HelloSign credentials |
| DocuSign | `DOCUSIGN_ACCESS_TOKEN`, `DOCUSIGN_ACCOUNT_ID`, optional `DOCUSIGN_BASE_URL` |
| HelloSign | `HELLOSIGN_API_KEY`, optional `HELLOSIGN_CLIENT_ID`, `HELLOSIGN_TEST_MODE` |

Rules:
- `REQUESTED` only after provider 2xx with external id
- `CONFIRMED` only when DocuSign status=`completed` or HelloSign `is_complete=true`
- Governed manual path remains available without live credentials

## 3. Calendar sync (Google / Outlook)

Default: `SALES_CALENDAR_ADAPTER=unavailable` — activity stays Edge-only; sync event logged.

| Mode | Env |
|------|-----|
| Auto | `SALES_CALENDAR_ADAPTER=auto` + Google **or** Outlook token |
| Google | `GOOGLE_CALENDAR_ACCESS_TOKEN`, optional `GOOGLE_CALENDAR_ID` |
| Outlook | `OUTLOOK_CALENDAR_ACCESS_TOKEN` |

`SYNCED` only on 2xx with provider event id.

## 4. Authenticated Playwright (FE)

```bash
cd saas-template-frontend
# CSRF smoke always:
npm run test:e2e:sales

# Authenticated UI (requires Edge user + storage state):
EDGE_E2E_AUTH=1 EDGE_E2E_USERNAME=… EDGE_E2E_PASSWORD=… npm run test:e2e:sales:auth
```

Project `chromium-edge-auth` matches `edge-sales-scenarios.spec.ts`.

## 5. Staging / P0-H

P4 code + migrate check do **not** clear P0-H.8. Staging remains **NO-GO** until `docs/edge/release/p0-h/` gates (especially H.8) pass. See `13-qualification-report.md` and `14-remaining-limits-registry.md`.
