# Backend spec — Profile (Screen 24)

"Profil" — the account hub (the 5th bottom tab). An identity card plus grouped
settings rows (Santé / Commandes & paiement / Compte). The row **labels, icons,
and navigation targets are client-side** (i18n `profile.*`); the API only supplies
the member identity and a few dynamic counts/labels shown as row subtitles.

Client is **mock-first**: `src/features/profile/api/profileApi.ts` (`USE_MOCK`).
View-model: `src/features/profile/types.ts` (`ProfileData`).

> Rows that don't have a screen yet (order history, insurance profile, payment
> methods, settings, sign-out, edit, theme toggle) toast `common.comingSoon`.
> Live rows: **Mon dossier santé** → `/health-record`, **Profils dépendants** →
> `/dependents`, **Mes ordonnances** → the Ordonnances tab.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/me/profile`

Requires auth. Returns the identity header and the dynamic bits the settings rows
render as subtitles.

**200 Response `data`** (`ProfileData`)
```jsonc
{
  "header": {
    "name": "Camille Martin",
    "email": "camille.martin@email.com",
    "initials": "CM",
    "verified": true,          // drives the "✓ Vérifié" pill
    "insurer": "Harmonie"      // short label pill next to it
  },
  "meta": {
    "dependentsCount": 2,      // → "2 proches"
    "prescriptionsCount": 3,   // → "3 actives"
    "insurerName": "Harmonie Mutuelle",
    "paymentMethod": "Cash"
  }
}
```

**`verified`** is the identity/KYC status; **`insurer`** is a display shorthand of
the mutuelle on file. Profile photo is not wired yet (dashed placeholder).

## PATCH `/me/profile` (edit — deferred)

The edit pencil is presentational for now. When wired: `{ name?, email?, phone?,
avatar? }` (avatar as `multipart/form-data`), returns the updated `ProfileData`.

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
