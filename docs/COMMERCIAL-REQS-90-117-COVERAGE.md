# Coverage matrix — Requirements 90–117

Honest status after migrations `022` / `048`.

| # | Requirement | Status | What is in code |
|---|-------------|--------|-----------------|
| **90** | Indexes | **COVERED** | Selective indexes: channel/warehouse orders, product lines, payment status, supplier PO, RM payment, active reservations |
| **91** | Tests | **PARTIAL** | Broad unit coverage; property + race specs; commercial DB E2E still deferred (identity e2e only) |
| **92** | Concurrency | **COVERED** | `fefo-last-unit-race.spec.ts` — 100 buyers / 1 unit |
| **93** | Property tests | **COVERED** | Seeded random invariant properties (no new deps) |
| **94** | Business invariants | **COVERED** | `commercial-invariants.ts` + specs; pharma/immutability/discount elsewhere |
| **95** | OpenAPI | **COVERED** | Export + tags incl. AI/Copilot/Config; refresh after deploy |
| **96** | Domain docs | **COVERED** | `docs/COMMERCIAL-LIFECYCLES.md` |
| **97** | Diagrams | **COVERED** | `COMMERCIAL-C4.md`, `COMMERCIAL-SEQUENCES.md` |
| **98** | AI readiness | **COVERED** | `commercial-ai` heuristic/non-mutating APIs |
| **99** | AI Copilot | **COVERED** | `commercial-copilot` query services + `copilot:query` RBAC |
| **100** | Performance | **COVERED** | `COMMERCIAL-PERFORMANCE.md` + latency metrics |
| **101** | TX boundaries | **PARTIAL** | Documented target; confirm+reserve still sequential (recon detects drift) |
| **102** | Eventual consistency | **COVERED** | `COMMERCIAL-CONSISTENCY.md` |
| **103** | Reconstruction | **COVERED** | `GET /inventory/ledger/explain` + finance AR explain |
| **104** | No magic numbers | **PARTIAL** | `commercial_org_config` + policies; some defaults remain |
| **105** | Tenant config | **COVERED** | `/commercial-config` org knobs |
| **106** | Multi-currency | **PARTIAL** | FX snapshot columns on SO/invoice/payment; historical rates table exists; pricing path still currency-string first |
| **107** | Multi-facility | **COVERED** | Existing fulfillment plans |
| **108** | AvailabilityPolicy | **COVERED** | Alias + `applyAvailabilityPolicy` + config CRUD |
| **109** | Priority engine | **COVERED** | `priority.engine.ts` + config rules |
| **111** | Retention | **COVERED** | Config fields + `COMMERCIAL-RETENTION.md` |
| **112** | Feature flags | **COVERED** | `enable_ctp`, AI replenishment, mobile POS, loyalty, consignment |
| **113** | Code quality | **NOTE** | Use-case/DDD patterns; large use-case files remain debt |
| **117** | Policies | **COVERED** | ORDER added to policy types; specialized policy codes in config |

## Migrations

```bash
pnpm migrate:control
pnpm migrate:tenant <tenantId>
```

Needs `048_commercial_reqs_90_117_permissions` and `022_commercial_reqs_90_117`.
