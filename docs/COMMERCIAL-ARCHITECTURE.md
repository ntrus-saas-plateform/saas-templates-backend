# Commercial Architecture (Phase 0 Discovery)

## Verdict

Platform Core is an **Identity + Customer control plane** with a rebuilt commercial stack through reqs **4–117**: core OMS/inventory through commissions/loyalty/analytics, platform hardening, plus AI readiness, copilot queries, explain/reconstruction, org config, and retention (reqs **90–117**).

Legacy `commerce` remains dropped (`015_drop_commerce.sql`).

## Decisions

| Decision | Choice |
|----------|--------|
| Persistence | **PostgreSQL DB-per-tenant** (not SurrealDB) |
| Rebuild strategy | New bounded contexts — **do not** revive legacy `commerce` |
| Application style | Use-case classes (existing pattern), not `@nestjs/cqrs` |
| Stock mutations | **Only** via Inventory ports |
| Pricing on confirm | **Frozen snapshots** — no live re-quote |
| Cache | Redis cache-aside for lookup only — never transactional SoT |
| AI / Copilot | Non-transactional; must **not** bypass sales/inventory/finance engines |

## Module map (high level)

Core: `catalog`, `inventory`, `pricing`, `sales`, `fulfillment`, `finance-commercial`, `returns`, `purchasing`, `pos`

Extensions: `commissions`, `contracts`, `loyalty`, `vouchers`, `workflow`, `rules`

Platform surfaces: `commercial-search`, `commercial-ops`, `commercial-analytics`, `commercial-readmodels`, `commercial-jobs`, `commercial-webhooks`, `commercial-config`, `commercial-ai`, `commercial-copilot`

## Migrations

- Tenant: `016`–`022`
- Control-plane: `041`–`048`

## Related docs (reqs 90–117)

- `COMMERCIAL-LIFECYCLES.md`, `COMMERCIAL-C4.md`, `COMMERCIAL-SEQUENCES.md`
- `COMMERCIAL-CONSISTENCY.md`, `COMMERCIAL-TRANSACTION-BOUNDARIES.md`
- `COMMERCIAL-PERFORMANCE.md`, `COMMERCIAL-RETENTION.md`

## Golden rule

> Sales decides what the customer buys. Pricing decides the price. Inventory decides what is sellable and traceable (incl. pharma quality). Fulfillment moves goods. Finance posts immutable commercial documents (corrections via reversal/CN/adjustment). Jobs reconcile and expire. Webhooks notify externally with signed deliveries. AI/copilot advise and explain — they never own stock or money movements.
