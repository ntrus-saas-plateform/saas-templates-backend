# Backend spec — Product detail (Screen 33)

An OTC/Rx catalog product page: hero, cheapest price + pharmacy count,
indications, caution note, and spec stats (form / lab / reimbursement). A
full-screen route (`/product/{id}`) reached by tapping a catalog card (Screen 10).
"Comparer" opens the pharmacy price picker (`/choose-pharmacy/{id}`); "Ajouter"
adds to the cart.

Client is **mock-first**: `src/features/catalog/api/catalogApi.ts`
(`fetchProductDetail`, `USE_MOCK`). View-model:
`src/features/catalog/types.ts` (`ProductDetail`). Unspecced products fall back to
synthesized defaults derived from the catalog row.

> The heart (favorite) is presentational → toast `common.comingSoon`.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/catalog/{id}`

Requires auth. Returns the enriched product (the catalog row + monograph fields).

**200 Response `data`** (`ProductDetail`)
```jsonc
{
  "id": "prd_1",
  "name": "Doliprane 1000mg",
  "dci": "Paracétamol",
  "descriptor": "Boîte de 8 comprimés",
  "rx": false,                       // → "Sans ordonnance" / "Sur ordonnance" badge
  "fromPrice": 1.95,                 // cheapest offer, display currency
  "pharmacyCount": 5,
  "indications": "Traitement symptomatique des douleurs d'intensité légère à modérée…",
  "warning": "Ne pas dépasser 3g/jour. Demandez conseil à votre pharmacien.",
  "formLabel": "Comprimé",
  "labo": "Sanofi",
  "reimbursement": 65,               // reimbursement rate %, 0 = none
  "tile": "green",
  "icon": "tablet"
}
```
`warning` is optional (absent → the amber caution box is hidden). `fromPrice` /
`pharmacyCount` come from the cheapest live `PharmacyOffer` (see
`docs/backend/12-choose-pharmacy.md`).

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
| 404 | unknown product id |
