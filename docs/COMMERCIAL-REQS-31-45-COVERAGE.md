# Coverage matrix — Requirements 31–45 (+ replenishment 46)

Honest status after migrations `019` / `045` and implementation in fulfillment / returns / finance / sales / pos / purchasing / inventory / customer.

| # | Requirement | Status | What is in code |
|---|-------------|--------|-----------------|
| **31** | Shipping | **COVERED** | Shipment enrichment (address/cost/SLA/promised/deliveryStatus); `PATCH /fulfillment/shipments/:id/delivery`; POD on deliver + `/pod`; delivery SM unit test |
| **32–33** | Returns | **COVERED** | `src/modules/returns` SM + quality decisions; inventory `receiveReturn` / dispose; `quantity_returned` update; `/returns` APIs; events `return.*.v1` |
| **34** | Credit | **COVERED** | `creditAvailable`; ledger on invoice/payment/credit note/debit note; `adjustCreditUsed`; hold blocks confirm; `credit:override` bypass (seeded in CP `041` as `credit`/`override`); `GET /customers/:id/credit`; overdue via AR aging + NET terms parse |
| **35** | AR | **COVERED** | `GET /finance/ar/open-items` with 0-30/31-60/61-90/90+ buckets |
| **36** | Payments | **COVERED** | `RefundPaymentUseCase` + `finance.payment.refunded.v1`; mixed methods sum validation |
| **37** | Invoicing | **COVERED** | Credit note / debit note / proforma / receipt document types; `POST /finance/invoices/debit-notes`; posted invoices immutable (no update API) |
| **38** | POS | **COVERED** | `PosCheckoutUseCase` composes sales+finance; `POST /pos/checkout`; `@RequireModule('pos')` |
| **39** | Offline POS | **COVERED** | `SyncOfflineOperationUseCase` idempotency/conflict; `POST /pos/offline/sync`, `GET pending` |
| **40** | Omnichannel | **COVERED** | origin/fulfill channel+warehouse + mode on create; `POST /sales/orders/:id/handoff`; channel seeds CALL_CENTER / MOBILE_POS |
| **41–44** | Purchasing | **COVERED+** (Wave 1) | MVP suppliers/PR/PO/GRN + Wave 1: lifecycle, RFQ/quotes, 3-way SoT, invoice docs, landed cost docs, MCP — see `docs/procurement/` |
| **45–46** | Demand / replenishment | **COVERED** | Reorder policies CRUD upsert; suggest engine ROP/EOQ/min-max; accept→PR; demand forecasts |

## PARTIAL gaps (honest)

- POS checkout invoices from **CONFIRMED** (takeaway) — full ship-before-invoice still available on non-POS path.
- `inventory_inbound` CONFIRMED write on GRN is optional and not always created (receiveLot is the stock path).
- OpenAPI static export + edge-frontend clients should be refreshed after deploy.
- Circular Nest import risk Sales↔Finance↔POS — monitors DI at boot.
- Procurement Wave 1: AP ledger / GL posting **out of scope**; Docker HTTP 5-tenant procurement e2e **not yet**; see `docs/procurement/EVIDENCE-AUDIT.md`.

## Migrations

```bash
pnpm migrate:control
pnpm migrate:tenant <tenantId>
```

Needs `045_commercial_reqs_31_45_permissions` and `019_commercial_reqs_31_45`.
