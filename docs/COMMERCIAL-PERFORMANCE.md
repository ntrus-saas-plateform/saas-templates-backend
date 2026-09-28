# Commercial Performance

## Targets

| Concern | Practice |
|---------|----------|
| Multi-tenant | DB-per-tenant pools; never cross-tenant queries |
| Avoid N+1 | Batch line loads; join ledger/order lists; prefer set-based SQL |
| Short TX | Mutate only what must be atomic; no remote calls inside TX |
| Cache-aside | Redis for price/product/availability lookups — **never** transactional SoT |
| Dashboard projection | Write `rm_*` / dashboard tables asynchronously; read projections in UI |
| Indexes | Selective indexes on channel/warehouse/status (migration `022`) |
| AI / Copilot | Read-only composition; timeouts; no stock locks |

## Anti-patterns

- Re-quoting prices inside long loops without batch  
- Holding open transactions while calling external payment gateways  
- Treating cache hits as inventory truth  
- Loading full ledger history when a grouped `SUM` / explain snapshot suffices  

## Measurement

Use commercial latency histograms / correlation IDs (`commercial-shared` metrics) and reconciliation jobs to detect drift without blocking the hot path.
