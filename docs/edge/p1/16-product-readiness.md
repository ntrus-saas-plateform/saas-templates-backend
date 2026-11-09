# Product Readiness (P1.13)

## Engine

`evaluateProductReadiness` (domain) + `EvaluateProductReadinessUseCase` (application).

Checks currently enforced from persisted mappings/bindings:

- Product has vertical
- Product version present
- Required capability mappings with validated technical status
- Optional PRIMARY backend binding when profile rule `requirePrimaryBackend` is set

Results: `NOT_READY` | `NEEDS_REVIEW` | `READY` | `BLOCKED`

Each evaluation is persisted as an immutable snapshot in `edge_readiness_evaluations` (history retained; new runs append).

## Profiles

`edge_readiness_profiles` — versioned rule bags. Default rules are data-driven; no single hard-coded checklist for all products.

## Separation

Technical readiness ≠ commercial availability ≠ tenant entitlement. No automatic promotion between dimensions.

## API / UI

- `POST /api/v1/edge/products/:id/readiness`
- `GET /api/v1/edge/readiness-evaluations`
- Console: product detail Readiness tab + `/edge/readiness` board
