# Backend spec — Send a prescription (Screen 14)

"Envoyer une ordonnance" — the member photographs/uploads a prescription to a chosen
pharmacy for the pharmacist to process. A full-screen route (`/send-prescription`),
reached from the catalog's `RxBanner` ("Une ordonnance ?"). Fields: a capture method
(photo / gallery / scan), an optional note for the pharmacist, and an insurance toggle.

> **Provisional** — part of the Commander/ordering flow Edgar will rework
> ([[commander-future-changes]]).

> **Native capture is deferred.** The camera/gallery/scanner picker is presentational
> for now (no `expo-camera` / `expo-image-picker`), to avoid a native rebuild given the
> disk constraint ([[env-disk-constraint]]) — same stance as the Permissions screen.
> When wired, the client attaches the captured file(s) to the POST below.

Client is **mock-first**: `src/features/prescriptions/api/prescriptionsApi.ts` (`USE_MOCK`).
View-models: `src/features/prescriptions/types.ts`.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/prescriptions/send-context`

Requires auth. Returns the target pharmacy (the user's chosen/nearest) and the
member's insurance-on-file, to pre-fill the form.

**200 Response `data`** (`SendContext`)
```jsonc
{
  "pharmacyId": "ph_centre",
  "pharmacyName": "Pharmacie du Centre",
  "etaMinutes": 30,          // "votre pharmacien la traite sous {n} min"
  "insurer": "Harmonie Mutuelle",
  "memberNo": "1234 5678"
}
```

## POST `/prescriptions`

Submit the prescription. **`multipart/form-data`** once capture is wired — the
document image(s) plus a JSON `meta` part:

```jsonc
// meta part (SubmitPrescriptionInput)
{
  "pharmacyId": "ph_centre",
  "method": "photo",         // photo | gallery | scan (how it was captured)
  "note": "Préférence générique",  // optional
  "useInsurance": true
}
// files part: images[] — the prescription photo(s) / scanned PDF
```

**200 Response `data`** (`SubmitPrescriptionResult`)
```jsonc
{ "prescriptionId": "rx_2026_0731", "etaMinutes": 30 }
```

On success the client toasts "Ordonnance envoyée · traitée sous {n} min" and pops.
The created prescription is pharmacy-scoped (`tenantId` server-assigned) and shows up
in the Scripts/Ordonnances list with status "en attente de traitement".

---

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
| 413 | image(s) too large |
| 415 | unsupported file type |
| 422 | no document attached, or unreadable image |
