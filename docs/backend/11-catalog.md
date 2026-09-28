# Backend spec — Order / Catalog (Screen 10)

The Commander tab: a searchable, category-filterable product grid with a
prescription-scan shortcut and a floating cart summary. Category filter + search
run **client-side** over one cached set (`react-query` key `['catalog']`).

Client is **mock-first**: `src/features/catalog/api/catalogApi.ts` (`USE_MOCK`).
View-models: `src/features/catalog/types.ts` (`CatalogProduct`). The raw API DTOs
(`Product`, `ProductCategory`) consumed by `services/endpoints/products.ts` also
live there.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/catalog`

Requires auth. Returns catalog rows for the user's area. Each row collapses a
`Medication` + its cheapest `PharmacyOffer` (across nearby pharmacies) into one card.

**Query**

| param | type | notes |
|---|---|---|
| `lat`, `lng` | number? | area for pricing/availability; falls back to saved default |
| `category` | CatalogCategory? | server-side filter (client also filters locally) |
| `q` | string? | name search (client also filters locally) |

**200 Response `data`**
```jsonc
[
  {
    "id": "prd_1",
    "name": "Doliprane 1000mg",
    "descriptor": "Boîte de 8",       // pack / brand descriptor
    "fromPrice": 1.95,                 // cheapest PharmacyOffer.price
    "pharmacyCount": 5,                // # pharmacies stocking it nearby
    "category": "pain",                // pain | vitamins | hygiene | baby | derma
    "rx": false,                       // prescription required
    "tile": "green",                   // pastel tile: green|yellow|blue|pink
    "icon": "tablet"                   // tablet|capsule|bottle|toggle
  }
]
```

- `tile` / `icon` are presentation hints the server derives from category + form so
  the grid stays visually varied; the client just maps them to colors/glyphs.
- `rx: true` shows the dark "Rx" badge; ordering these later requires a valid
  prescription (Section — Rx flow).

---

## Cart (client-side today)

The floating **CartBar** reads `useCartStore` (zustand): `count` = Σ item quantities,
`total` = Σ unitPrice·qty. The card **+** button calls `addItem`. The bar is hidden
when the cart is empty and appears on first add.

Future server sync:

| endpoint | purpose |
|---|---|
| `POST /cart/items` | add/replace a line (persist cross-device) |
| `GET /cart` | hydrate cart on launch |
| `POST /rx/scan` | the "Une ordonnance ?" banner → OCR a prescription into a cart |

---

## Notes
- **Multi-tenant:** `fromPrice` + `pharmacyCount` aggregate `PharmacyOffer`s across
  tenants; the per-pharmacy breakdown (and tenant selection) happens on the product
  detail / cart, not here. Client never sends `tenantId`.
- Prices shown with a `.` decimal + `€` to match the design; localize per currency
  when i18n currency formatting lands.
- **Center FAB:** the Order tab's raised TabBar FAB turns emerald when active (ink on
  every other tab) — handled in `TabBar.tsx`.
- See [[screen-progress]] — Section B — Core.
