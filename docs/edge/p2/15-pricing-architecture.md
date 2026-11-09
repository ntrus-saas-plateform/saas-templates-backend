# Pricing architecture (Increment 1)

## Principles
- Price attaches to commercial items (plan / add-on / package), never to a bare product.
- Amounts are `NUMERIC(19,6)` in PostgreSQL and bigint fixed-scale (10^6) in application math.
- Currency is mandatory ISO 4217 on price books and entries.
- Preview API is pure calculation — no invoices, payments, or subscriptions (P7).

## Implemented models in calculator
`FLAT_FEE`, `PER_USER`, `PER_LOCATION`, `PER_DEVICE`, `PER_BRANCH`, `PER_TRANSACTION`, `USAGE_BASED`, `ONE_TIME`, `RECURRING`, `HYBRID`.

Tiered/volume/custom enterprise calculation tables exist in schema (`edge_pricing_models.model_type`) and will get dedicated evaluators in Increment 2.

## Price books
- Scoped to a single `product_id`
- Geographic scope + currency
- Entries reference commercial item type/id
- Versioned; publication snapshots freeze referenced book id when publishing a plan

## Explicit non-goals
- No FX auto-conversion as a substitute for local strategy
- No invented RDC/Burundi tariffs
- No tax engine (reference only)
