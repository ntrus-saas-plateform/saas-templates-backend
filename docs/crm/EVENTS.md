# CRM Events (Wave 1)

Registered in `event-catalog.ts`. Tenant mutations use transactional outbox + `commercialEvent`.

| Event | When |
|-------|------|
| `crm.lead.created.v1` | Lead created |
| `crm.lead.assigned.v1` | Lead assigned |
| `crm.lead.status_changed.v1` | Lead lifecycle transition |
| `crm.lead.converted.v1` | Lead → customer |
| `crm.opportunity.created.v1` | Opportunity created |
| `crm.opportunity.stage_changed.v1` | Pipeline stage change |
| `crm.opportunity.won.v1` / `lost.v1` | Terminal stages (if emitted) |
| `crm.campaign.created.v1` | Campaign created |
| `crm.campaign.status_changed.v1` | Campaign lifecycle |
| `crm.campaign.message.sent.v1` | WhatsApp (or channel) message accepted by provider |
| `crm.campaign.message.failed.v1` | WhatsApp (or channel) message failed |
| `crm.task.completed.v1` | Task completed |
| `crm.customer.score_computed.v1` | Score version written |
| `crm.credit.updated.v1` | CRM credit profile upsert |

Existing customer lifecycle events (`customer.registered.v1`, `customer.merged.v1`, …) and loyalty (`loyalty.points.*.v1`) remain authoritative for identity / points.
