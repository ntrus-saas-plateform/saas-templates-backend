# Product Catalog (P1.2)

## Purpose

Control-plane registry of SaaS products. One product → exactly one vertical. Not a commercial plan.

## Persistence

`edge_products` in `074_edge_product_catalog.sql` (Control Plane only).

Key fields: `code`, `slug`, `vertical_id`, `lifecycle_status`, `technical_status`, `commercial_availability`, `default_version_id`, optimistic `row_version`.

## Lifecycle

`DRAFT → CONFIGURING → TECHNICAL_VALIDATION → READY_FOR_PUBLICATION → PUBLISHED → DEPRECATED → RETIRED → ARCHIVED`

Publication is a dedicated use-case (`PublishProductUseCase`), not a raw field update.

## Vertical isolation

`assertProductVerticalAccess` / `resolveProductListVerticalFilter`:

- Global Edge context (`verticalId = null`): may operate across verticals (requires global product permissions).
- Workspace context: may only read/mutate products of the active vertical.
- `EdgeOptionalWorkspaceGuard` on `/edge/products/**` enriches permissions when `x-edge-workspace-session` is present.

## APIs

`/api/v1/edge/products` — list/create/get/patch/lifecycle/versions/compatibilities/capabilities/bindings/readiness/publish

## UI

`/edge/catalog`, `/edge/catalog/new`, `/edge/catalog/[productId]`, vertical products page.
