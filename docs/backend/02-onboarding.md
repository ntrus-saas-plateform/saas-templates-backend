# Backend spec — Onboarding (Screens 02–04)

The 3-slide value pager is **client-static first-run content**. It renders entirely
from the local i18n dictionary (`onboarding.*` keys) and the persisted `hasOnboarded`
flag (MMKV) — no network call is required to display it, so it works fully offline.

Two backend concerns exist, both **optional / non-blocking**:

1. **Remote content** — let marketing tune slide copy without an app release.
2. **Analytics** — measure activation funnel (viewed → completed vs skipped).

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/content/onboarding` (optional, non-blocking)

Public (no auth). Fetched opportunistically after the slides are already on screen;
if it 4xx/5xx or times out, the client keeps the bundled i18n copy. Cache aggressively.

**Query**
| param | type | notes |
|---|---|---|
| `locale` | `'fr' \| 'en'` | current app language; server falls back to `fr` |

**200 Response `data`**
```jsonc
{
  "version": 1,                       // bump to invalidate client cache
  "slides": [
    {
      "key": "meds",                  // stable id → maps to local illustration
      "title": "Vos médicaments,",
      "accent": "toujours à portée",  // rendered in Caveat script
      "body": "Suivez vos traitements, vos rappels et vos ordonnances depuis votre téléphone."
    },
    { "key": "delivery",  "title": "Commandez en un", "accent": "instant",         "body": "…" },
    { "key": "reminders", "title": "Ne ratez plus",   "accent": "une seule prise", "body": "…" }
  ]
}
```

**Client rules**
- Illustrations stay **client-side** (keyed by `slide.key`); the server only supplies
  text. An unknown `key` → skip that slide's remote text, keep the local copy.
- Never block first paint on this call.

---

## POST `/analytics/events` (optional, fire-and-forget)

Public (no auth; anonymous device id acceptable pre-signup). Batched, best-effort.

**Body**
```jsonc
{
  "events": [
    { "name": "onboarding_slide_viewed", "props": { "index": 0, "key": "meds" }, "ts": "<ISO>" },
    { "name": "onboarding_completed",     "props": { "via": "get_started" },      "ts": "<ISO>" },
    { "name": "onboarding_skipped",       "props": { "atIndex": 1 },              "ts": "<ISO>" }
  ]
}
```

**Events emitted by Screens 02–04**
| event | when |
|---|---|
| `onboarding_slide_viewed` | each slide settles into view |
| `onboarding_completed` | last slide → "Get started" (→ Sign up, Screen 20) |
| `onboarding_skipped` | "Skip" tapped (→ Login, Screen 05) — includes `atIndex` |

---

## Notes
- **No `tenantId`** — onboarding is platform-global, shown before any pharmacy is chosen.
- Completion (either "Get started" or "Skip") sets the local `hasOnboarded` flag; the
  splash boot check (see `01-system-boot.md`) never shows these screens again.
- Endpoints are additive: v1 of the app can ship with neither and behave correctly.
