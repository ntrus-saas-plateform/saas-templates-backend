# P10 — Enterprise acquisition

## Intent

Parcours non self-serve : `price_display_mode ∈ { QUOTE_REQUIRED, ENTERPRISE_CUSTOM }` → devis avant checkout.

## Flux implémenté

1. Plan presentation en mode quote/enterprise
2. `CreateQuoteRequestUseCase` → `edge_p10_quote_requests`
3. `AttachQuoteReferenceUseCase` — `external_quote_ref` (source `P2_COMMERCIAL` / `SALES_MANUAL` / …)
4. `AcceptQuoteUseCase`
5. Checkout exige `quoteReferenceId` (`assertCheckoutAllowedForPriceMode`)

## API

- `POST edge/acquisition/quotations`
- `POST edge/acquisition/quotations/:id/references`
- `POST edge/acquisition/quotations/:id/accept`

## Ce que P10 ne fait pas

- Calcul / négociation de prix (P2 / sales)
- Contract management / e-sign
- Provisioning tenant enterprise (P7/P8)

## Discovery

Alias commercial availability `ENTERPRISE` / `BY_REQUEST` acceptés pour présentation publique si produit présentable.

## Statut

**Orchestration quote BE DONE.** FE enterprise wizard **pending**.
