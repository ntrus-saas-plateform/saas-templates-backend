# P4 — Bounded Context Map

| # | Context | Responsibility | Aggregate root(s) | Depends on |
|---|---------|----------------|-------------------|------------|
| 1 | Sales CRM Foundation | Registry, search, timeline, notes, tasks, views | Timeline/Note (supporting) | Accounts, Contacts |
| 2 | Commercial Account Mgmt | Orgs, hierarchy, dedup, merge | CommercialAccount | P1 products refs |
| 3 | Contact & Stakeholder | People, roles, influence | SalesContact | Accounts |
| 4 | Team & Territory | Teams, territories, ownership | SalesTeam | Edge administrators |
| 5 | Lead Acceptance & Qualification | P3 bridge, accept/reject/qualify | SalesLead | P3 leads |
| 6 | Opportunity Mgmt | Deals, risks, competitors | Opportunity | Accounts, Contacts |
| 7 | Pipeline Mgmt | Stages, transitions, velocity | PipelineDefinition | Opportunities |
| 8 | Activities & Engagement | Calls, meetings, tasks | SalesActivity | Context refs |
| 9 | Needs & Solution Consulting | Discovery, fit, gaps | NeedsAssessment | Opportunities, P1/P2 |
| 10 | Offer Configuration | Compose from P2 | OfferConfiguration | P2 |
| 11 | Quote & Proposal | Versioned quotes/PDFs | Quote, Proposal | Offer config |
| 12 | Deal Desk | Discounts, exceptions | DiscountRequest | Quotes |
| 13 | Commercial Approvals | Policies, decisions | CommercialApproval | Deal desk |
| 14 | Contract Mgmt | Contracts, e-sign status | CommercialContract | Quotes/Orders |
| 15 | Sales Order | Operational sold package | SalesOrder | Contracts |
| 16 | Closing & Handoff | Close gates + handoff dossier | SalesHandoff | Orders |
| 17 | Performance & Forecast | Dashboards (honest metrics) | Read models | All |
| 18 | Governance & Audit | Audit trail | SalesAuditEvent | All |

**Anti-corruption:** P3 marketing activities appear on unified timeline with `provenance=MARKETING`. P2 prices are snapshotted into quotes; live P2 changes do not mutate issued quotes.
