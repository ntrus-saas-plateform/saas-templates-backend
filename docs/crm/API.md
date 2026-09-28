# CRM API (Wave 1)

## Staff customer master (existing)

Base: `/api/v1/customers` — `@RequireModule('customer')` + `@RequiresCapability('CRM')`

CRUD, guest, duplicates, identify, promote, merge, anonymize, export, commercial, patient, contacts, consents, interactions, 360.

## CRM engine

Base: `/api/v1/crm` — `@RequireModule('customer')` + `@RequiresCapability('CRM')`

| Area | Paths (illustrative) | Permission | Extra capability |
|------|----------------------|------------|------------------|
| Leads | `POST/GET /crm/leads`, assign, transition, convert | `crm:lead` | `LEAD_MANAGEMENT` |
| Opportunities | `POST/GET /crm/opportunities`, stage | `crm:opportunity` | `OPPORTUNITY_MANAGEMENT` |
| Activities / tasks / notes | `/crm/activities`, `/crm/tasks`, `/crm/notes` | `crm:write` | ACTIVITY/TASK/NOTE |
| Segments | `/crm/segments`, members | `crm:segment` | `CUSTOMER_SEGMENTATION` |
| Scoring | `POST /crm/customers/:id/score` | `crm:segment` | `CUSTOMER_SCORING` |
| Campaigns | `/crm/campaigns`, transition, audience, `POST .../dispatch-whatsapp` | `crm:campaign` | `CAMPAIGNS` |
| Credit profile | `/crm/customers/:id/credit-profile` | `crm:credit` | `CUSTOMER_CREDIT` |
| Analytics | `GET /crm/analytics` | `crm:read` | `CRM_ANALYTICS` |
| Enriched 360 | `GET /crm/customers/:id/360` | `customers:read` | `CUSTOMER_360` |

**Idempotency:** `Idempotency-Key` on POST/PATCH.  
**Concurrency:** `expectedVersion` on opportunity/campaign/credit → **409**.

## MCP

`search_customer`, `get_customer`, `create_customer`, `merge_customer`, `create_lead`, `qualify_lead`, `create_opportunity`, `update_opportunity`, `get_customer_360`, `get_customer_timeline`, `get_customer_segments`, `get_loyalty_balance`, `award_loyalty_points`, `redeem_loyalty_points` — deny-by-default in `mcp-tool-permissions.ts`.
