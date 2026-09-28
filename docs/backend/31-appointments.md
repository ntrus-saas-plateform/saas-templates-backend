# Backend spec — Book appointment (Screen 31)

"Prendre rendez-vous" — book a pharmacy service (vaccination, screening,
pharmaceutical consult, medication review). A full-screen route
(`/book-appointment`) reached from the Home "Rendez-vous" quick-access tile. Pick
service → day → time slot; the CTA reflects the selection ("Confirmer · Mer 28,
14:00").

Client is **mock-first**: `src/features/appointments/api/appointmentsApi.ts`
(`USE_MOCK`). View-model: `src/features/appointments/types.ts` (`BookingContext`).

> The 4 service kinds are a fixed client catalogue (i18n `appointments.*`); days &
> slots come from availability. Confirm is a stub → toast `appointments.booked` +
> back (no `POST` yet).

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/appointments/availability`

Requires auth. Returns bookable days and time slots (ideally filtered by the
chosen service + pharmacy; the mock returns a single shared set). Weekday labels
are server-localized.

**200 Response `data`** (`BookingContext`)
```jsonc
{
  "days": [
    { "id": "mon", "weekday": "Lun", "day": 26, "available": true },
    { "id": "wed", "weekday": "Mer", "day": 28, "available": true }
    // …
  ],
  "slots": [
    { "id": "s0900", "label": "09:00", "available": true },
    { "id": "s1115", "label": "11:15", "available": false },  // taken → strikethrough
    { "id": "s1400", "label": "14:00", "available": true }
    // …
  ],
  "defaultDayId": "wed",
  "defaultSlotId": "s1400"
}
```

A production call would take `?service=…&day=…` and return slots for that day.

## POST `/appointments`

Book: `{ "service": "vaccination", "dayId": "wed", "slotId": "s1400" }`. Returns
the created appointment (id, confirmed datetime) and pushes a confirmation
notification (see `docs/backend/30-notifications.md`). Slot is held/locked
server-side to avoid double-booking.

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
| 409 | slot no longer available (client refetches availability) |
| 422 | service not offered at this pharmacy |
