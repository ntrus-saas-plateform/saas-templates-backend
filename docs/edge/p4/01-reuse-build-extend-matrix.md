# P4 — Reuse / Build / Extend Matrix

| Capability | Decision | Evidence / target |
|------------|----------|-------------------|
| Edge auth / RBAC / workspace | **REUSE** | P0 guards + `edge_permissions` |
| CP outbox / audit | **REUSE** | Outbox + `edge_audit_events` |
| Product / vertical catalog | **REUSE** | P1 |
| Plans / packages / add-ons / price books | **REUSE** | P2 tables + ports |
| Offer configurator / pricing-math | **EXTEND** | `domain/commercial/offer-configurator` for quote snapshots |
| Marketing leads + provenance | **EXTEND** | `edge_sales_leads.marketing_lead_id` + `POST /leads/receive` + handler `marketing.lead.qualified.v1` |
| P2 catalog / configure / preview | **REUSE** | `/commercial/catalog`, `/offers/configure`, `/pricing/preview` — never fork price books |
| Campaign approval UC pattern | **REUSE (pattern)** | Mirror for future deal-desk approvals; no second workflow engine |
| Tenant CRM `043_crm_*` | **DO NOT REUSE** | Confirmed out of Edge SoT |
| Edge console shell / gates / states | **REUSE** | `edge-shell`, permission gates |
| Commercial Account / Contact / Team | **BUILD** | `081` + `domain/sales` |
| Sales lead inbox / accept / qualify | **BUILD** | Bridge from P3 |
| Opportunity + pipeline stages | **BUILD** | `082` + opportunity UCs |
| Activities / needs assessment | **BUILD** | `083` + commerce UCs |
| Quotes / proposals / discounts | **BUILD** | `084` — snapshot P2 versions via configurator |
| Contracts / e-sign adapter | **BUILD** | `085` — EXECUTED only with provider confirm |
| Sales orders / handoff | **BUILD** | `085` — no direct tenant create; idempotent |
| Forecasting / analytics | **BUILD** | `085` snapshots + `computeForecast` — never revenue |
| Tenant CRM | **DO NOT REUSE** | Separate plane |
| Second catalog / fake revenue / fake provision | **FORBIDDEN** | — |
