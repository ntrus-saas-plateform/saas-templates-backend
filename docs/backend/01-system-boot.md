# Backend spec — System & Boot (Screen 01 · Splash)

The client app is the consumer front-end of a multi-tenant pharmacy SaaS. The boot
sequence on Screen 01 resolves three things before routing: **forced-update**,
**maintenance**, and **session validity**.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/app/config`

Public (no auth). Resolves app-gating flags at splash. Cache-bust on every cold start.

**Query**
| param | type | notes |
|---|---|---|
| `platform` | `'ios' \| 'android'` | from the client |
| `version` | string | the installed app version (semver) |

**200 Response `data`**
```jsonc
{
  "minSupportedVersion": "1.0.0",   // < this → forced update (Screen 39)
  "latestVersion": "1.0.0",
  "maintenance": {
    "active": false,
    "message": null,                // localized message when active (Screen 38)
    "estimatedEndsAt": null         // ISO datetime or null
  },
  "storeUrl": {                     // deep links for the forced-update CTA
    "ios": "https://apps.apple.com/app/id000000000",
    "android": "https://play.google.com/store/apps/details?id=com.syntixpharma.app"
  }
}
```

**Client routing logic**
1. `version < minSupportedVersion` → **Screen 39 Forced update** (blocking).
2. `maintenance.active` → **Screen 38 Maintenance** (retry + ETA).
3. else → session check below.

---

## GET `/auth/me`

Requires `Authorization: Bearer <accessToken>`. Validates the persisted session and
returns the current user. On `401`, the axios interceptor attempts a refresh
(`POST /auth/refresh`); if that fails, tokens are cleared and the app routes to Login.

**200 Response `data`** → `User` (see `src/types/models.ts`).

**Routing after session check**
- valid session → **Home** `/(tabs)`
- no/expired session, first run → **Onboarding** (Screens 02–04)
- no/expired session, returning → **Login** (Screen 05)

> "First run" is tracked client-side via a persisted `hasOnboarded` flag (MMKV),
> not a backend field.

---

## Notes
- No `tenantId` here — boot/config and identity are platform-global. Tenant scoping
  begins once the user searches pharmacies (Screens 10–12).
- `/app/config` must be fast and CDN-cacheable; it gates every cold start.
