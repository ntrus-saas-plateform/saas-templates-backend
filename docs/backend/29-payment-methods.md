# Backend spec — Payment methods (Screen 29)

"Moyens de paiement" — manage the member's saved payment methods and preferred
currency. A full-screen route (`/payment-methods`) reached from the Profile tab's
"Moyens de paiement" row.

Method **labels/icons are client-side** (i18n `payment.*` / `paymentMethods.*`);
only availability + the insurance default come from the API. Currency is
**device-local** (`settingsStore.currency`, persisted) — the 4-tile selector
writes to it directly.

Client is **mock-first**: `src/features/payment/api/paymentApi.ts`
(`fetchPaymentMethods`, `USE_MOCK`). View-model:
`src/features/payment/types.ts` (`PaymentMethodsView`). Lives in the payment
feature alongside Screen 17.

> Espèces (cash, "Par défaut") is always active; Mobile Money & Carte bancaire are
> "Bientôt" (dimmed, non-selectable); "Ajouter un moyen de paiement" and the card
> add flow toast `common.comingSoon`.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/me/payment-methods`

Requires auth. Returns the insurance-billing default (the rest of the method list
is a fixed client catalogue for now).

**200 Response `data`** (`PaymentMethodsView`)
```jsonc
{
  "insuranceEnabled": true,   // Assurance santé switch default
  "insurer": "Harmonie",      // short label
  "coverageRate": 70          // → "Harmonie · 70%"
}
```

## PATCH `/me/payment-methods` (deferred)

`{ insuranceEnabled?, defaultMethod?, currency? }`. When real card/mobile methods
land they become server-side tokens (PSP vault); adding one runs the
tokenization/3-DS flow. Currency preference may also persist server-side (today
it's local only).

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
