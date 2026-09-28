# Backend spec — Dependent profiles (Screen 26)

"Profils dépendants" — the account holder plus the relatives whose treatments they
manage from one account (family/caregiver model). A full-screen route
(`/dependents`) reached from the Profile tab's Santé section. Selecting a profile
would switch the app's active member context (deferred).

Client is **mock-first**: `src/features/profile/api/profileApi.ts`
(`fetchDependents`, `USE_MOCK`). View-model:
`src/features/profile/types.ts` (`Dependent`).

> Card taps (switch profile) and "+ Ajouter un proche" are presentational for now
> → toast `common.comingSoon`. The account holder's card carries the emerald ring
> and the "Moi" pill.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/me/dependents`

Requires auth. Returns the managed profiles, **account holder first** (`isSelf:
true`), each with its treatment count.

**200 Response `data`** (`Dependent[]`)
```jsonc
[
  { "id": "self",   "name": "Camille Martin", "initials": "CM", "isSelf": true,               "age": 34, "treatments": 3 },
  { "id": "lucas",  "name": "Lucas Martin",   "initials": "LM", "isSelf": false, "relation": "Fils", "age": 8,  "treatments": 1 },
  { "id": "jeanne", "name": "Jeanne Martin",  "initials": "JM", "isSelf": false, "relation": "Mère", "age": 67, "treatments": 4 }
]
```

`relation` is absent on the `isSelf` entry. The subtitle is composed client-side:
`[relation] · {age} ans · {treatments} traitements`.

## POST `/me/dependents` (add — deferred)

Body `{ "name", "relation", "birthDate" }`. Returns the created `Dependent`. The
new relative inherits the holder's pharmacy/insurance context; consent/legal
guardianship checks apply server-side for minors.

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
| 403 | dependent belongs to another account |
| 422 | invalid relation / missing guardian consent |
