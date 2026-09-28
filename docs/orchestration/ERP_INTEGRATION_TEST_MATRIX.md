# ERP Integration Test Matrix (req 111)

| Source | Destination | Sync/Event | Criticality | Evidence |
|--------|-------------|------------|-------------|----------|
| Sales | Inventory | Command | Critical | `InventoryEngineService` / adapter |
| Sales | Pricing | Query | Critical | `PricingEngine.quote` on confirm |
| Sales | Payment | Command | Critical | Finance capture / POS checkout |
| Sales | Accounting | Event | Critical | `accounting.ar.entry.requested.v1` |
| Inventory | Accounting | Event | Critical | `inventory.accounting.intent.v1` / posting pending |
| Purchasing | Inventory | Event/Command | Critical | Goods receipt → inventory receive |
| POS | Sales | Command | Critical | `PosCheckoutUseCase` |
| POS | Payment | Command | Critical | Capture in checkout |
| Warehouse | Inventory | Command | Critical | Fulfillment / issue via engine |
| Sales | Analytics | Event | Non-critical | Outbox catalog events |
| Sales | Notification | Event | Non-critical | Notification adapter / jobs |

## Contract testing (req 112–113)

- Contracts live in `src/modules/orchestration/domain/contracts.ts` with `contractVersion: '1.0'`.
- **Compatibility**: additive optional fields allowed; breaking changes require `1.1` / `2.0` and dual-read period.
- **Deprecation**: mark in `ERP_INTEGRATION_CONTRACTS.md`; remove only after consumers migrated + recon green.
- Unit specs cover policy/recon/saga engines; full Pact consumer/provider suites = FUTURE.
