# ADR — Explicit Revenue Recognition Policy

**Status:** Accepted  
**Date:** 2026-11-10

## Decision

Recognized revenue is never silently equal to billed revenue.

| Method | Meaning |
|--------|---------|
| `CASH_BASED_NET` (default seed) | Succeeded payments − succeeded refunds |
| `BILLING_BASED` | Issued invoice totals (must be labeled; finance approval required for external use) |
| `DEFERRED_MANUAL` | `recognizedRevenue = null` until explicit postings |

Stored in `edge_billing_revenue_policies`. Overview/analytics include method + disclaimer.

## Consequences

ASC-606 multi-element deferral is out of P6 scope and must not be faked.
