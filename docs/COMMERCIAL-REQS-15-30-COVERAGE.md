# Coverage matrix — Requirements 15–30

Honest status after migrations `018` / `044` and implementation in catalog / inventory / pricing / sales / fulfillment.

| # | Requirement | Status | What is in code |
|---|-------------|--------|-----------------|
| **15** | Substitution | **COVERED** | `ProductSubstitution` + approvals; CRUD `/catalog/substitutions`; request/approve/reject; apply on order line (sales); backorder substitute validates allowed substitutes; events `catalog.substitution.*.v1` |
| **16** | Kits | **COVERED** | `ProductKit` + components; CRUD `/catalog/kits`; `explodeKit`; EXPLODED expands on SO create; AS_BUNDLE no explode; unit test diabetes kit |
| **17** | Consignment | **COVERED** | `consignment_accounts` CRUD via inventory repo; receive sets ownership + `consignment_account_id`; ATP `byOwnership` buckets; OWNED_ONLY policy; unit test 70+30 |
| **18–19** | Channels | **COVERED** | Full channel entity/columns; CRUD + seed defaults; channel inventory allocations; confirm subtracts reserved_pct/dedicated; allocation_policy.strategy read on confirm |
| **20–21** | Pricing upgrade | **COVERED** | `list_type` priority in `findApplicablePrice`; QuoteParams customerId/location/currency; publish bumps version + `price_list_versions`; TaxEngine called from PricingEngine; volume/channel tests |
| **22–23** | Promotions | **COVERED** | `promotion.engine` BXGY/stacking; CRUD `/pricing/promotions`; integrated in quote + SO create/confirm via `applyActivePromotions`; unit tests |
| **24** | Discount auth | **COVERED** | Limits port/repo; assert helper; confirm blocks / creates PENDING; approve API; seed roles; unit test agent/manager/director |
| **25** | Tax engine | **COVERED** | Independent `TaxEngine`; commercial rates/profiles CRUD; legacy `tax_rules` fallback; PricingEngine must use TaxEngine; unit tests |
| **26** | Cart engine | **COVERED** | Price on add via PricingEngine; convert requires customerId; PATCH attach customer; abandon status |
| **27** | Reservation ≠ Allocation | **COVERED** | Domain comments on entities + event catalog wording; concepts remain separate (no merge) |
| **28** | Fulfillment engine | **COVERED** | `CreateFulfillmentPlanUseCase` multi-WH split; fulfillment_type; pick tickets per WH; partial pick → PARTIALLY_FULFILLED; dropship/store pickup types |
| **29** | Picking | **COVERED** | `pick_strategy` on create; waves; FEFO lot-expiry sort; PRIORITY sort; partial complete |
| **30** | Packing | **COVERED** | `CreatePackageUseCase` + `/fulfillment/packages`; PKG sequence; link shipment; light unit test |

## PARTIAL gaps (honest)

- Confirm + reserve still sequential outbox TXs (pre-existing).
- Cart expire job / TTL scheduler not implemented (abandon is manual status).
- Channel dedicated stock applied on confirm; not every allocate path re-checks channel pools.
- RULE_BASED / MARGIN / ORDER allocate strategies remain FEFO stubs (from 4–14).
- OpenAPI + edge-frontend clients should be refreshed after deploy (`pnpm docs:openapi:static`).
- Discount auth on confirm now wired from JWT roles + `sales:discount_approve`.
- Consignment accounts: HTTP CRUD at `/inventory/consignment-accounts`.

## Migrations

```bash
pnpm migrate:control
pnpm migrate:tenant <tenantId>
```

Needs `044_commercial_reqs_15_30_permissions` and `018_commercial_reqs_15_30`.
