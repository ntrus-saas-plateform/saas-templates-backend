# Backend spec — Add medication (Screen 32)

"Ajouter un médicament" — search the drug referential (or scan a box barcode),
pick a drug, set posology + reminder times, add it to the treatment list. A
full-screen route (`/add-medication`) reached from the Meds tab "+".

Client is **mock-first**: `src/features/meds/api/medsApi.ts`
(`fetchAddMedContext`, `USE_MOCK`). View-models: `src/features/meds/types.ts`
(`AddMedContext`, `DrugRefItem`, `PosologyDraft`).

> Barcode scan (dark button) and "+" add-time are presentational (no camera /
> time picker yet → toast `common.comingSoon`). Posology values are display-only
> defaults in the mock. Submit stubs → toast `addMed.added` + back.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/drugs?q={query}`

Requires auth. Searches the national medication referential; returns matches plus
a suggested default posology. Debounced client-side; the query keys the cache.

**200 Response `data`** (`AddMedContext`)
```jsonc
{
  "drugs": [
    { "id": "drug_doli1000", "name": "Doliprane 1000mg", "descriptor": "Paracétamol · Comprimé", "form": "tablet" },
    { "id": "drug_dafalgan", "name": "Dafalgan 500mg",   "descriptor": "Paracétamol · Gélule",   "form": "capsule" },
    { "id": "drug_doli_cod", "name": "Doliprane Codéine", "descriptor": "Paracétamol/Codéine",     "form": "tablet" }
  ],
  "defaultPosology": { "dose": "1", "frequency": "3×/j", "duration": "5 j", "times": ["08:00","13:00","20:00"] }
}
```
`form` ∈ the `MedForm` union → drives the row icon. A barcode scan resolves to a
single drug via `GET /drugs/by-barcode/{ean}`.

## POST `/me/treatments`

Add to treatment: `{ "drugId": "drug_doli1000", "posology": { "dose","frequency","duration","times" } }`.
Returns the created `MedItem` (see `docs/backend/09-meds.md`); the client
invalidates `['meds']` and schedules the reminder notifications for `times`.

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
| 404 | unknown drug / barcode |
| 422 | invalid posology |
