# Offer configurator (Increment 2 start)

Deterministic rule engine — **never** grants entitlements, subscriptions, or tenant rights.

## Modes
- `MANUAL_CONFIGURATION`
- `RULE_BASED_RECOMMENDATION`
- `GUIDED_CONFIGURATION`

## API
`POST /api/v1/edge/commercial/offers/configure`  
Permission: `platform:commercial:catalog:read`

## Rules applied
1. Plan / package / add-on product ownership
2. Product lifecycle (`PUBLISHED` preferred)
3. Capability inclusion vs P1 technical + commercial availability
4. Optional geography allow-list
5. Optional deployment mode vs P1-validated modes

## Output
- `decision`: `ELIGIBLE` | `ELIGIBLE_WITH_RESTRICTIONS` | `INELIGIBLE` | `NEEDS_REVIEW` | `INSUFFICIENT_INFORMATION`
- Explainability arrays: `appliedRules`, `satisfied`, `unsatisfied`, `restrictions`
- `grantsEntitlements: false` always

## Domain
`src/modules/edge/domain/commercial/offer-configurator.ts`
