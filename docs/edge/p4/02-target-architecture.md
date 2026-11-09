# P4 — Target Architecture

## Placement

P4 lives in the **SaaS Control Plane** (Okapi Edge), hexagonal Nest module `modules/edge` subdomain `sales`.

```
P3 Marketing Leads ──► Sales Lead Inbox ──► Qualification
                              │
                              ▼
                    Commercial Account + Contacts
                              │
                              ▼
                         Opportunity + Pipeline
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         Activities    Needs Assessment   Offer Config (P2)
              │               │               │
              └─────── Quotes / Proposals ────┘
                              │
                    Deal Desk / Approvals
                              │
                         Contracts (e-sign)
                              │
                         Sales Orders
                              │
                    Handoff ──► Subscription / Provisioning
                              │
                              ▼
                    ProvisioningReference (confirmed only)
```

## Aggregates (foundation increment)

1. **CommercialAccount** — commercial relationship; never a tenant.
2. **SalesContact** — person; multi-account over history via roles.
3. **SalesTeam / Territory / Assignment**
4. **SalesLead** — sales-side acceptance record referencing P3 lead id.
5. **SalesTimelineEvent / Note / Task** — CRM foundation.

Later aggregates: Opportunity, Quote, Contract, SalesOrder, Handoff (separate migrations).

## Invariants (always)

- Backend-generated UUIDs only.
- Status transitions enforced in domain.
- Idempotent lead receive (`marketing_lead_id` unique).
- No automatic merge on name similarity.
- OpportunityWon ≠ provisioning.
- Contract Executed requires signature confirmation.
- Quote Issued is immutable; edits → new version.

## Event bus

`sales.*.v1` via CP outbox; consumers idempotent; correlation id required.
