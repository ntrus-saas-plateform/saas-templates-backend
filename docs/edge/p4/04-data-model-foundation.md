# P4.1 — Data Model (CRM Foundation)

## Tables (migration `081`)

| Table | Aggregate / role |
|-------|------------------|
| `edge_sales_teams` | SalesTeam |
| `edge_sales_territories` | SalesTerritory |
| `edge_sales_team_members` | Assignment |
| `edge_sales_commercial_accounts` | CommercialAccount (≠ tenant) |
| `edge_sales_account_relationships` | Hierarchy / partner links |
| `edge_sales_account_merge_events` | Controlled merge audit |
| `edge_sales_contacts` | SalesContact |
| `edge_sales_contact_roles` | Role history |
| `edge_sales_leads` | SalesLead (unique `marketing_lead_id`) |
| `edge_sales_lead_decisions` | Acceptance / qualification history |
| `edge_sales_notes` | Internal notes |
| `edge_sales_timeline_events` | Unified timeline (`provenance` SALES/MARKETING/SYSTEM) |
| `edge_sales_tasks` | CRM tasks |

## Identifiers

- All primary keys: `gen_random_uuid()`
- Account numbers: `CA-######` via `edge_sales_account_number_seq`
- No frontend-supplied technical IDs for create

## Non-goals in 081

- Opportunities, quotes, contracts, orders, handoff (later migrations)
- Tenant FK on accounts (forbidden)
