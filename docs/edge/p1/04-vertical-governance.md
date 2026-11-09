# Vertical Governance (P1.1)

## Purpose

Extend the P0 vertical registry into a governed lifecycle without duplicating memberships or IAM.

## Model

Reuses `edge_verticals` (P0). Adds:

- Lifecycle statuses: `DEPRECATED`, `RETIRED`, `ARCHIVED` (CHECK expanded in `074`)
- `edge_vertical_lifecycle_events` for from→to transitions with actor/reason
- Domain transitions via `assertVerticalTransition` in `vertical.entity.ts`

## APIs

Existing `/api/v1/edge/verticals/**` plus lifecycle actions (deprecate / retire / archive) and lifecycle event history.

## Rules

- Physical delete of a vertical with published products or historical references is not an ordinary operation.
- Activation of a vertical ≠ commercial publication of a product.
- Vertical admins cannot mutate another vertical without an explicit global permission.

## UI

- Global: Vertical Registry + detail + associated products link
- Workspace: current vertical info + products list under `/edge/verticals/:id/products`
