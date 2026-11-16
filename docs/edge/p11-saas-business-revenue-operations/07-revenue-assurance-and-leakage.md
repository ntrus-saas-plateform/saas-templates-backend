# 07 — Revenue assurance & leakage

## Purpose

Detect evidence-driven revenue leakage / mismatch cases. P11 **does not** create corrective invoices or payments.

## Detectors (`revenue-assurance.ts`)

| Detector | Signal |
|----------|--------|
| Subscription without billing setup | Active/billing-required sub missing schedule/link |
| Billing without subscription ref | Billing artifact lacks subscription UUID |
| Price mismatch | Expected vs actual amount beyond tolerance |

Insufficient evidence → `null` (no invented case). Partial fields → `dataQuality=ESTIMATED` with confidence.

## Leakage case lifecycle

`DETECTED → TRIAGED → INVESTIGATING → CONFIRMED → REMEDIATING → RESOLVED | WRITTEN_OFF | FALSE_POSITIVE → CLOSED`

Soft refs: `subscription_ref_id`, `invoice_ref_id` only.

## Hard rule

**No duplicate ledger.** Cases annotate risk; they are not AR subledgers.
