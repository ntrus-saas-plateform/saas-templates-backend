# Backend spec — Notifications (Screen 30)

The activity feed — dose reminders, order updates, pharmacist messages, insurance
events, prescription expiries. A full-screen route (`/notifications`) reached from
the Home header bell. Time-grouped (Aujourd'hui / Hier); unread items get an
emerald tint + dot. Tapping a card marks it read and deeplinks to the related
screen.

Client is **mock-first**: `src/features/notifications/api/notificationsApi.ts`
(`USE_MOCK`). View-model: `src/features/notifications/types.ts`
(`AppNotification`).

> Read state and "mark all read" are **local/optimistic** in the mock. Titles &
> bodies are server-localized **content** (kept as-is, not run through i18n — only
> the section headers and screen title are localized).

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/me/notifications`

Requires auth. Returns notifications newest-first with their group bucket.

**200 Response `data`** (`AppNotification[]`)
```jsonc
[
  { "id": "n1", "kind": "reminder",     "title": "Rappel : Amoxicilline", "body": "C'est l'heure de votre prise de 13:00", "time": "13:00", "unread": true,  "group": "today",     "route": "/(tabs)/meds/reminders" },
  { "id": "n2", "kind": "order",        "title": "Commande prête",        "body": "#CMD-2026-0542 vous attend à la pharmacie", "time": "11:24", "unread": true,  "group": "today",     "route": "/order-tracking?id=CMD-2026-0542" },
  { "id": "n3", "kind": "message",      "title": "Message de Thomas R.",  "body": "Le générique est disponible, je le prépare.", "time": "10:02", "unread": false, "group": "today",     "route": "/chat?id=thread_centre" },
  { "id": "n4", "kind": "insurance",    "title": "Assurance validée",     "body": "Harmonie a pris en charge 70% de votre commande", "time": "17:45", "unread": false, "group": "yesterday", "route": "/insurance-profile" },
  { "id": "n5", "kind": "prescription", "title": "Ordonnance bientôt expirée", "body": "L'ordonnance du Dr. Lefèvre expire dans 5 jours", "time": "09:10", "unread": false, "group": "yesterday", "route": "/(tabs)/scripts" }
]
```

`kind` ∈ `reminder | order | message | insurance | prescription` → drives the tile
icon/tone. `group` ∈ `today | yesterday` (server buckets by day; older buckets
would extend this). `route` is the in-app deeplink to open.

## POST `/me/notifications/read`

Mark read: `{ "ids": ["n1","n2"] }` or `{ "all": true }`. Delivery of new
notifications is push (the token registered when the Notifications setting is on —
see `docs/backend/27-settings.md`).

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
