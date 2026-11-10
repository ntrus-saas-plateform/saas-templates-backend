# P6 � Invoice State Machine

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**

## Statuses (invoice aggregate)

`DRAFT` ? `ISSUED` ? **`PARTIALLY_PAID`** | **`PAID`** | **`OVERDUE`**  
Branches: **`VOID`**, **`WRITTEN_OFF`**

| Status | Meaning |
|--------|---------|
| `DRAFT` | Editable lines; not legally issued |
| `ISSUED` | Immutable lines/totals; amount due established |
| `PARTIALLY_PAID` | Some payment allocated; balance > 0 |
| `PAID` | Balance = 0 via confirmed payments/credits only |
| `OVERDUE` | Issued, past due date, balance > 0 |
| `VOID` | Draft void or governed void of issued (audited) |
| `WRITTEN_OFF` | Governed bad debt close |

**Note:** Payment attempt failures do not revert `ISSUED` � they affect payment aggregates only.

## Allowed transitions

| From | To | Guard (summary) |
|------|-----|-----------------|
| `DRAFT` | `ISSUED` | `issue` permission; validation; tax snapshot captured |
| `DRAFT` | `VOID` | Cancel draft |
| `ISSUED` | `PARTIALLY_PAID` | Confirmed allocation < total due |
| `ISSUED` | `PAID` | Confirmed allocation = total due |
| `ISSUED` | `OVERDUE` | Due date passed, balance > 0 (system/job) |
| `PARTIALLY_PAID` | `PAID` | Further confirmed allocation |
| `PARTIALLY_PAID` | `OVERDUE` | Due date passed, balance > 0 |
| `*` (issued family) | `WRITTEN_OFF` | Approval + `manage_approvals` |
| `ISSUED` | `VOID` | Exception path + approval (rare) |

Illegal transitions rejected in domain; append `edge_invoice_status_history` (in `091`).

## Immutability at issue

| Field class | After `ISSUED` |
|-------------|----------------|
| Line items, quantities, unit amounts | **Frozen** |
| Tax snapshot | **Frozen** |
| Commercial snapshot ref | **Frozen** |
| Bill-to on invoice | **Frozen** (profile may evolve for future invoices) |

Corrections: **credit memo** or **new invoice** � never silent line UPDATE.

## PAID guard (never fake)

| Condition | Allowed |
|-----------|---------|
| Provider `PaymentAttempt` ? `SUCCEEDED` with proof id | Yes |
| Verified `http_webhook` normalized confirmation | Yes |
| Operator `confirm_payment` with attached proof artifact | Policy + audit |
| Adapter `UNAVAILABLE` auto-complete | **Forbidden** |
| Manual status flag without ledger + attempt | **Forbidden** |

## Events (examples)

| Transition | Event |
|------------|-------|
| ? `ISSUED` | `billing.invoice.issued.v1` |
| ? `PAID` | `billing.invoice.paid.v1` |
| ? `OVERDUE` | `billing.invoice.overdue.v1` |
| ? `VOID` | `billing.invoice.voided.v1` |
