# CRM Architecture — Wave 1 (Phase 6)

## Bounded context

**Owns:** Customer relationship extensions — leads, opportunities, activities, tasks, notes, segments/groups, scoring, campaigns (**EMAIL / WHATSAPP / IN_APP / PUSH** — **no SMS**), CRM credit **profile**, Customer 360 / timeline **projections**.

**Does not own:** SalesOrder, Invoice, Payment, AR ledger, Inventory, PurchaseOrder, Prescription, InsuranceClaim, Shipment. Loyalty **point ledger** remains in `src/modules/loyalty`.

## Module strategy

Extend existing [`src/modules/customer`](../../src/modules/customer) + reuse [`loyalty`](../../src/modules/loyalty) — **no** second CRM Nest module / auth / outbox / accounting.

```
presentation/crm.controller.ts + customers.controller.ts
  → application/crm/*
  → domain/crm/* (+ ports, WhatsApp campaign channel port)
  → infrastructure/persistence/pg-crm-engine.repository.ts
  → infrastructure/whatsapp/{noop,meta}-whatsapp.adapter.ts
```

## Customer master (existing)

GlobalCustomer → TenantCustomer → OrganizationCustomer (control plane) remains SoT for identity.

Wave 1 adds tenant-DB CRM engine tables (`043_crm_engine_v1.sql`).

## Multi-vertical

Same CRM engine; differentiation via `BusinessContext.enabledCapabilities` only:

| Profile (example) | Typical caps |
|-------------------|--------------|
| Pharmacy | CRM + PATIENT + LOYALTY + CAMPAIGNS + CUSTOMER_360 |
| Supermarket | CRM + LOYALTY + CAMPAIGNS + SEGMENTATION |
| Restaurant | CRM + LOYALTY + CAMPAIGNS |
| Retail/Boutique | CRM + LOYALTY + CAMPAIGNS + SEGMENTATION |
| Wholesale | CRM + OPPORTUNITY + CREDIT + GROUPS + B2B |

No `if (businessType === 'PHARMACY')` in CRM core.

## Customer 360 / Timeline

Projection only (`customer_timeline_events`). Sources: `customer.*`, `crm.*`, `sales.order.*`, `loyalty.points.*`, finance events (append-only). Handler: `customer-timeline.handler.ts`.

## Credit

`crm_customer_credit_profiles` is a **CRM document**. Outstanding exposure / AR remain finance-commercial.

## Privacy

Reuse existing anonymize/export/view filters (`customers:view_sensitive`, merge audits). Campaign frequency respects opt-out / quiet period policies in domain.

## Migrations

- Tenant: `043_crm_engine_v1.sql`
- Control-plane: `060_crm_permissions.sql`
