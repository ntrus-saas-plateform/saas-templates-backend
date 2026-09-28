# Commercial business error codes

Explicit `ErrorCode` values used by the Commercial Engine (`src/core/domain/errors/domain-error.ts`).

| Code | Meaning |
|------|---------|
| `INSUFFICIENT_STOCK` | ATP/allocation cannot cover requested quantity |
| `PRODUCT_NOT_SELLABLE` | Product/SKU commercial status is not ACTIVE |
| `PRICE_NOT_FOUND` | No applicable price list item for the quote context |
| `CUSTOMER_CREDIT_EXCEEDED` | Order would breach customer credit limit/hold |
| `ORDER_ALREADY_CONFIRMED` | Confirm called on an already confirmed order |
| `INVALID_STATE_TRANSITION` | Document state machine forbids the transition |
| `RESERVATION_EXPIRED` | Soft reservation TTL elapsed |
| `ALLOCATION_CONFLICT` | Concurrent lot allocation conflict |
| `LOT_EXPIRED` | Lot past expiry / below min shelf life |
| `LOT_RECALLED` | Lot or product under recall |
| `PRODUCT_QUARANTINED` | Quality status quarantine blocks sell/issue |
| `PAYMENT_FAILED` | Payment capture/validation failed |
| `DUPLICATE_OPERATION` | Idempotent replay of a completed critical command |
| `TENANT_ACCESS_DENIED` | Cross-tenant or missing tenant context |
| `APPROVAL_REQUIRED` | Workflow/discount/credit approval gate |

Platform codes also apply: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `CONFLICT`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`.
