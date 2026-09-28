# Backend spec — My reminders (Screen 09)

The dose timeline for a given day: an adherence summary + a chronological list of
scheduled doses with per-dose status. Lives in the Médicaments tab stack
(`app/(tabs)/meds/reminders.tsx`), reached from the meds list bell and the med
detail's "Modifier les rappels".

Client is **mock-first**: `src/features/reminders/api/remindersApi.ts`
(`USE_MOCK = true`). View-models: `src/features/reminders/types.ts`.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/me/reminders?date=YYYY-MM-DD`

Requires auth. Returns the reminder day for `date` (defaults to today). Cached
client-side per date (`['reminders', date]`) so the day switcher pages smoothly.

**200 Response `data`**
```jsonc
{
  "dateLabel": "Aujourd'hui",   // server-localized relative label
  "dateSub": "mer. 27 mai",     // server-localized long date
  "takenCount": 2,
  "total": 6,
  "entries": [
    {
      "id": "re_1",
      "time": "08:00",
      "medName": "Doliprane 1000mg",
      "dose": "1 comprimé",
      "status": "taken"          // ReminderStatus: taken | now | upcoming | missed
    }
  ]
}
```

- `status` drives the row: `taken` (green node + "Pris"), `now` (ring node,
  emerald-bordered card, "Bientôt" + Pris/Reporter actions), `missed` (red node,
  pink card, "Manqué"), `upcoming` (hollow node, "À venir").
- `takenCount / total` feed the emerald summary hero + progress bar.
- Exactly one `now` entry is expected (the imminent dose); the client highlights it.

---

## POST `/me/reminders/{id}/taken`

Requires auth. The "Pris ✓" action on the imminent dose. Marks it taken and
returns the refreshed day so the summary advances without a full refetch.

**200 Response `data`** — the updated `ReminderDay` (as above).

## POST `/me/reminders/{id}/snooze`

Requires auth. The "Reporter" action. Body `{ "minutes": 15 }` (default). Reschedules
the dose and returns the updated `ReminderDay`.

---

## Notes
- **Local notifications:** each `entries[]` dose maps to a scheduled
  `expo-notifications` local notification on-device; the server is the source of
  truth for the schedule, the client mirrors it into OS notifications (deferred —
  see [[env-disk-constraint]], avoids a native rebuild for now).
- Reminders are user-scoped (a treatment can span pharmacies) — no `tenantId`.
- The "+" adds an ad-hoc reminder (future `POST /me/reminders`).
- See [[screen-progress]] — Section B — Core.
