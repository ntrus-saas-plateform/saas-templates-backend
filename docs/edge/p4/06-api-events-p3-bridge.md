# P4.1 — API / Events / P3 Bridge

## HTTP (prefix `/api/v1/edge/sales`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/overview` | analytics:read |
| GET/POST | `/teams` | teams:read / manage |
| POST | `/teams/:id/members` | teams:manage |
| GET/POST | `/territories` | teams:read / manage |
| GET/POST | `/accounts` | accounts:read / create |
| GET/PUT | `/accounts/:id` | accounts:read / update |
| POST | `/accounts/duplicates` | accounts:read |
| POST | `/accounts/merge` | accounts:merge |
| GET | `/accounts/:id/timeline` | accounts:read |
| GET/POST | `/contacts` | contacts:read / manage |
| GET | `/contacts/:id` | contacts:read |
| GET | `/leads` | leads:read |
| POST | `/leads/receive` | leads:accept |
| GET | `/leads/:id` | leads:read |
| POST | `/leads/:id/acceptance` | leads:accept |
| POST | `/leads/:id/rejection` | leads:reject |
| POST | `/leads/:id/qualification` | leads:qualify |
| POST | `/leads/:id/assignment` | leads:assign |
| POST | `/notes` | activities:manage |
| GET/POST | `/tasks` | activities:manage |
| POST | `/tasks/:id/complete` | activities:manage |

## Events (`sales.*.v1`)

- `sales.account.created.v1`
- `sales.account.merged.v1`
- `sales.contact.created.v1`
- `sales.lead.received.v1`
- `sales.lead.accepted.v1`
- `sales.lead.rejected.v1`
- `sales.lead.qualified.v1`
- `sales.lead.assigned.v1`

Outbox tenant: `edge-control-plane`.

## P3 → P4 contract

1. **Automatic:** `MarketingLeadQualifiedSalesHandler` consumes `marketing.lead.qualified.v1` (inbox-deduped via Rabbit consumer) and calls `ReceiveSalesLeadUseCase`.
2. **Manual:** Caller may also `POST /leads/receive` with `marketingLeadId`.
3. Unique constraint on `marketing_lead_id` → idempotent receive (`created: false` on repeat).
4. Provenance JSON stores marketing status, campaign, org, email.
5. Accept updates marketing lead → `SALES_ACCEPTED`.
6. Reject / recycle maps marketing → `DISQUALIFIED` / `RECYCLED`.
7. Marketing score never alone qualifies a sales lead (priority hint only on auto-receive).

See also [09-naming-boundaries-adr.md](./09-naming-boundaries-adr.md).

## Frontend

- Nav: `/edge/sales`
- Console tabs: Overview, Accounts, Contacts, Lead Inbox, Teams, Tasks
