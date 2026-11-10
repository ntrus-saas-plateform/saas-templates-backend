# P4 — API & Events Matrix

Base path: `/edge/sales` (Edge auth + permission guards).

## API families

| Family | Methods | Permissions |
|--------|---------|-------------|
| overview / analytics / forecast | GET | `analytics:read` / `forecast:read` |
| teams / territories | GET/POST | `teams:read` / `teams:manage` |
| accounts | GET/POST/PUT + duplicates/merge/timeline | `accounts:*` |
| contacts | GET/POST | `contacts:*` |
| leads | receive/accept/reject/qualify/assign | `leads:*` |
| opportunities / pipeline | CRUD + stages/close/reopen/risks/competitors | `opportunities:*` / `pipeline:manage` |
| activities / tasks / notes | GET/POST/complete | `activities:manage` |
| assessments | GET/POST/complete | `assessments:manage` |
| offers / quotes / proposals | CRUD + transition/revise/issue | `quotes:*` / `proposals:manage` |
| discount-requests / approvals | request + decide | `discounts:*` / `governance:manage` |
| contracts | create + transition | `contracts:*` |
| orders / handoff | create + transition + handoff + provisioning-status | `orders:manage` / `handoff:execute` |

## Domain events (outbox, `edge-control-plane`)

| Event type | Aggregate |
|------------|-----------|
| `sales.account.created.v1` / `merged.v1` | COMMERCIAL_ACCOUNT |
| `sales.contact.created.v1` | SALES_CONTACT |
| `sales.lead.*.v1` | SALES_LEAD |
| `sales.opportunity.*.v1` | SALES_OPPORTUNITY |
| `sales.needs_assessment.completed.v1` | NEEDS_ASSESSMENT |
| `sales.offer_configuration.created.v1` | OFFER_CONFIGURATION |
| `sales.quote.*.v1` | SALES_QUOTE |
| `sales.proposal.issued.v1` | SALES_PROPOSAL |
| `sales.discount.*.v1` | DISCOUNT_REQUEST |
| `sales.contract.*.v1` | COMMERCIAL_CONTRACT |
| `sales.order.created.v1` | SALES_ORDER |
| `sales.handoff.*.v1` / `sales.provisioning.status_received.v1` | SALES_HANDOFF |

## Security notes

- Closed Won quote/contract flags are **server-verified** (client booleans ignored).
- Discount / approval self-approve forbidden.
- Contract EXECUTED requires provider confirm **or** governed CONTRACT approval (manual path, audited).
- Signature adapter defaults to UNAVAILABLE (no fake e-sign).
