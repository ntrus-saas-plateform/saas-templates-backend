# Backend spec — Home dashboard (Screen 06)

The Home tab aggregates five widgets: greeting/location, today's dose reminders,
quick-access shortcuts (static), an active order summary, and the pharmacist roster.

Client is **mock-first**: `src/features/home/api/homeApi.ts` returns a canned
`HomeData` payload (`USE_MOCK = true`) so the screen is fully interactive before the
aggregation endpoint exists. The view-models live in `src/features/home/types.ts`.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/me/home`

Requires auth. One aggregation call so the dashboard paints in a single pass. The
server composes it from the caller's active treatments, today's reminder schedule,
the most recent in-flight order, and the user's saved pharmacies. Cached client-side
for 60s (`staleTime`); pull-to-refresh refetches.

**Query**

| param | type | notes |
|---|---|---|
| `lat`, `lng` | number? | optional — refines `location.nearbyCount`; falls back to the user's saved default area |

**200 Response `data`**
```jsonc
{
  "firstName": "Camille",
  "initials": "CM",
  "location": { "area": "Paris 9e", "nearbyCount": 12 },
  "reminders": [
    { "id": "rem_1", "medName": "Doliprane 1000mg", "dose": "1 comprimé", "time": "08:00", "status": "taken" },
    { "id": "rem_2", "medName": "Amoxicilline 500mg", "dose": "1 gélule", "time": "12:00", "status": "now" },
    { "id": "rem_3", "medName": "Vitamine D", "dose": "2 gouttes", "time": "20:00", "status": "upcoming" }
  ],
  "remindersDone": 1,
  "remindersTotal": 3,
  "activeOrder": {
    "id": "CMD-2026-0542",
    "status": "preparing",
    "step": 1,
    "handlerName": "Marie D.",
    "etaMinutes": 30
  },
  "pharmacists": [
    { "id": "ph_1", "name": null, "photoId": null }
  ]
}
```

- `reminders[].status` ∈ `taken | now | upcoming | missed` (mirrors `ReminderStatus`).
  `now` is the single highlighted (emerald) card; `remindersDone` counts `taken`.
- `activeOrder` is `null` when nothing is in flight → the card is hidden.
  `status` mirrors `OrderStatus`; `step` is the 0-based index into the 4-node stepper
  (`placed → preparing → ready → pickedup`).
- `activeOrder.handlerName` is the assigned pharmacist; ETA in minutes.
- `pharmacists[].photoId` resolves to a signed media URL; `null` → dashed "Photo"
  placeholder client-side.

---

## POST `/reminders/{id}/taken`  (dose check-off — future)

Requires auth. Marks a scheduled dose taken from the reminder card. Returns the
updated adherence counts so the progress bar advances without a full refetch.

**200 Response `data`** `{ "remindersDone": 2, "remindersTotal": 3 }`

---

## Notes
- **Multi-tenant:** `activeOrder` and `pharmacists` are pharmacy-scoped; the server
  resolves `tenantId` per entity — the client never sends it. Reminders/treatments are
  user-scoped (a treatment can span pharmacies).
- Quick-access tiles (Mes médicaments / Ordonnances / Commander / Rendez-vous) are
  static navigation — no backend.
- The bell badge (`hasNotifications`) will be driven by the notifications feed
  (Section D), not this payload; currently hard-set.
- See [[screen-progress]]; this opens Section B — Core.
