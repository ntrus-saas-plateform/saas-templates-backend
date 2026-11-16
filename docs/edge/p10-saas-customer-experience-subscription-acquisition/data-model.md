# P10 — Data model

## Tables `edge_p10_*` (migration 117)

### Présentations
- `edge_p10_product_presentations`
- `edge_p10_product_content_versions`
- `edge_p10_segment_presentations`
- `edge_p10_plan_presentations` (+ `price_display_mode`)

### Funnel
- `edge_p10_prospects`
- `edge_p10_acquisition_leads`
- `edge_p10_acquisition_lead_events`

### Forms
- `edge_p10_form_schemas`
- `edge_p10_form_versions`
- `edge_p10_form_publications`
- `edge_p10_document_requirements`

### Applications
- `edge_p10_applications`
- `edge_p10_application_answers`
- `edge_p10_application_events`
- `edge_p10_document_references`
- `edge_p10_document_reviews`
- `edge_p10_qualification_records`
- `edge_p10_review_assignments`

### Commercial / checkout
- `edge_p10_quote_requests`
- `edge_p10_quote_references`
- `edge_p10_checkout_sessions` (**pas** de colonnes carte)
- `edge_p10_checkout_events`
- `edge_p10_subscription_handoffs`

### Journey / CX ops
- `edge_p10_journey_definitions`
- `edge_p10_journey_instances`
- `edge_p10_journey_events`
- `edge_p10_communications`
- `edge_p10_analytics_events`
- `edge_p10_attribution_records`
- `edge_p10_audit_events`
- `edge_p10_idempotency_keys`

## Soft refs (pas toujours FK dures)

`commercial_account_id` (P4), `product_id` (P1), `commercial_plan_id` (P2) sur prospects/applications — UUID soft quand FK risquée.

## Optimistic concurrency

Colonnes `version INTEGER` sur agrégats principaux.

## Mapping types

`domain/acquisition/acquisition.types.ts` ↔ tables ci-dessus.
