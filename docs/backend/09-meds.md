# Backend spec — My treatment (Screen 07 · Meds tab)

The Meds tab lists the user's treatments with search + status filtering. Filtering
and search are **client-side** over one cached list (`react-query` key `['meds']`),
so every filter tab is served by a single fetch.

Client is **mock-first**: `src/features/meds/api/medsApi.ts` returns a canned
`MedItem[]` (`USE_MOCK = true`). View-models: `src/features/meds/types.ts`.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/me/treatments`

Requires auth. Returns the caller's treatments flattened for list display — each row
joins a `Treatment` with its `Medication` and current stock signal.

**Query**

| param | type | notes |
|---|---|---|
| `status` | `active \| paused \| done`? | optional server-side filter; client currently filters locally so this is an optimization |
| `q` | string? | optional name search; client currently filters locally |

**200 Response `data`**
```jsonc
[
  {
    "id": "trt_1",              // Treatment.id
    "name": "Amoxicilline",     // Medication.name
    "strength": "500mg",        // Medication.strength
    "formLabel": "Gélule",      // localized Medication.form label
    "form": "capsule",          // drives the row icon (see MedForm)
    "posology": "1 gélule, 3x/jour", // Posology.dose + freq
    "daysLeft": 5,              // Treatment.daysLeft
    "stock": "available",       // available | out  (from PharmacyOffer.stock)
    "status": "active"          // TreatmentStatus: active | paused | done
  }
]
```

- `form` ∈ `capsule | tablet | aerosol | drop | syrup | cream`. Superset of the base
  `GalenicForm` enum — `aerosol` (Ventoline) is added here for the icon; align the
  domain enum when the real catalog lands.
- `stock`: `out` renders the red "Rupture" signal; `available` the emerald "Disponible".
- `formLabel` is server-localized; the client shows it verbatim next to `strength`.

---

## GET `/me/treatments/{id}`  (Screen 08 · Détail)

Requires auth. Full treatment detail behind a tapped list row. Mock:
`fetchMedDetail(id)` (`MOCK_DETAILS`, falling back to a synthesized detail).

**200 Response `data`**
```jsonc
{
  "id": "trt_1",
  "name": "Amoxicilline",
  "strength": "500 mg",
  "formLabel": "Gélule",
  "form": "capsule",
  "dci": "Amoxicilline trihydrate",   // Medication.dci — active ingredient
  "status": "active",
  "dose":      { "value": "1",  "unit": "gélule" },   // Posology.dose
  "frequency": { "value": "3×", "unit": "/ jour" },   // Posology.freq
  "duration":  { "value": "5",  "unit": "jours" },    // Posology.durationDays
  "note": "À prendre au début des repas…",            // intake advice (nullable)
  "reminders": [ { "id": "r1", "time": "08:00", "enabled": true } ],
  "prescriber": {
    "initials": "LE",
    "name": "Dr. Pierre Lefèvre",
    "specialty": "Médecin généraliste",
    "date": "12 mai 2026"
  }
}
```

- `dose/frequency/duration` are pre-split into `{ value, unit }` for the big-number
  posology cards; the server localizes the units.
- `reminders[].enabled` toggles are optimistic client-side; persist via the PATCH below.

## Future endpoints (not yet wired)

| endpoint | purpose |
|---|---|
| `POST /me/treatments` | the list header **+** action — add a treatment (manual or from a prescription) |
| `PATCH /me/treatments/{id}` | pause / resume / stop; persist reminder toggles (detail switches) |
| `POST /cart` | detail **"Commander ce médicament"** → adds to cart, routes to Order |

---

## Notes
- **Multi-tenant:** stock (`PharmacyOffer`) is pharmacy-scoped; the server resolves the
  relevant pharmacy per treatment and returns a single `stock` signal — the client
  never sends `tenantId`. Treatments themselves are user-scoped and can span pharmacies.
- Empty list → localized `meds.empty` placeholder.
- See [[screen-progress]] — Section B — Core.
