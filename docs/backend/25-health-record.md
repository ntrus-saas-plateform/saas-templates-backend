# Backend spec — Health record (Screen 25)

"Mon dossier santé" — the member's medical profile: a drug-interaction alert,
key facts, allergies, and chronic conditions. A full-screen route
(`/health-record`) reached from the Profile tab's Santé section. The data feeds
the pharmacist's interaction checks.

Client is **mock-first**: `src/features/profile/api/profileApi.ts`
(`fetchHealthRecord`, `USE_MOCK`). View-model:
`src/features/profile/types.ts` (`HealthRecord`).

> The interaction alert's **"Contacter mon pharmacien"** CTA opens the pharmacist
> chat (`/chat`). Info-row taps and the chip "+ Ajouter" actions are
> presentational (edit is deferred → toast `common.comingSoon`).

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/me/health-record`

Requires auth. Returns the interaction alert (if any), the info facts, and the
allergy / chronic-condition tags.

**200 Response `data`** (`HealthRecord`)
```jsonc
{
  "alert": { "allergen": "Pénicilline", "medication": "Amoxicilline" },
  "info": [
    { "id": "dob",   "tone": "gray", "label": "Date de naissance", "value": "14/03/1991" },
    { "id": "blood", "tone": "red",  "label": "Groupe sanguin",    "value": "O+" },
    { "id": "body",  "tone": "gray", "label": "Poids / Taille",    "value": "64 kg · 168 cm" }
  ],
  "allergies":  [ { "id": "a_peni", "label": "Pénicilline" }, { "id": "a_arach", "label": "Arachides" }, { "id": "a_pollen", "label": "Pollen" } ],
  "conditions": [ { "id": "c_asthme", "label": "Asthme" }, { "id": "c_hta", "label": "Hypertension" } ]
}
```

**`alert`** is computed server-side by cross-checking the member's allergies
against the active treatment (here Pénicilline allergy ↔ Amoxicilline, same drug
family). Absent when no interaction is detected — the client hides the card.
`tone` drives the info-row icon tile color (client maps `red` → heart icon,
else a person icon).

## Mutations (deferred)

Adding/removing allergies & conditions and editing info facts are presentational
for now. When wired: `POST/DELETE /me/health-record/allergies`,
`/conditions`, and `PATCH /me/health-record` — each returns the updated
`HealthRecord` so the interaction alert re-evaluates.

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
