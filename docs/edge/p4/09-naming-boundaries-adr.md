# ADR — Sales naming boundaries (P4)

**Status:** Accepted  
**Date:** 2026-11-09  
**Context:** Explore reuse audit warned that “CommercialAccount” collides mentally with P2 commercial catalog, marketing prospect orgs, and SaaS tenants.

## Decision

| Name in P4 | Meaning | Must not be confused with |
|------------|---------|---------------------------|
| **Commercial Account** (`edge_sales_commercial_accounts`) | Control-plane **sales relationship** between Okapi Edge and an organization | P2 `edge_commercial_*` (catalog/pricing), SaaS `tenants`, tenant-DB CRM customers |
| **Sales Lead** (`edge_sales_leads`) | Sales-side acceptance record | `edge_marketing_leads` (P3 SoT for MQL) |
| **Marketing prospect org** | Pre-sales company in P3 | Commercial Account (may be created on accept) |
| **Tenant** | Provisioned product instance | Never created by P4 account/contract/Closed Won alone |

P4 keeps the domain term **Commercial Account** (spec language) while table prefix remains `edge_sales_*` and APIs live under `/edge/sales/**`.

## Consequences

- FKs to marketing leads are by `marketing_lead_id` (reference), not merge of registries.
- Optional future `provisioning_references` link tenants **after** confirmation from the provisioning domain.
- Quoting must call P2 `/offers/configure` and `/pricing/preview` — never fork price books.
