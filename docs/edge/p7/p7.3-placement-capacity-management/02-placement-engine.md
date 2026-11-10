# P7.3 — Placement engine

`evaluatePlacement(input)` is deterministic and **fail-closed**.

## Inputs

Request, product registry, technical version, platforms[], environments[], profiles[], contracts[], capacity rows[], optional ACTIVE policy, `now`, and compatibility evidence (fn or precomputed list).

## Hard gates

- Product `CERTIFIED` + `provisionable`; version `PUBLISHED` (+ support window).
- Platform `ACTIVE`+`CERTIFIED`; environment `ACTIVE`; profile `ACTIVE` (+ `CERTIFIED` mandatory for `PRODUCTION`).
- Data residency + security classification match.
- Compatibility `INCOMPATIBLE` → hard exclude.
- Capacity: missing inventory ≠ unlimited; stale `validUntil` fails; available must cover requirements.
- Policy scope product allowlist mismatch → hard exclude.

## Review (never auto-PLACED)

- Empty product allowlists.
- Empty policy `scope.productIds`.
- Compatibility `REQUIRES_REVIEW` / missing compatibility evidence.
- Non-prod uncertified profile (review signal).

## Scoring

Only survivors (`passedHardConstraints`) are scored. Weights from policy (`regionMatch`, `capacityHeadroom`, `preferredPlatform`, `compatibilityBonus`). Tie-break: `environment.id ASC`, then `platform.id ASC`.

## Outcomes

| Status | When |
|--------|------|
| `PLACED` | ≥1 placeable survivor (`COMPATIBLE`, capacity OK, no review flags) |
| `REQUIRES_REVIEW` | Review signals block auto-place |
| `NO_CAPACITY` | Otherwise-viable candidates blocked only by capacity |
| `NO_COMPATIBLE_TARGET` | No viable target after hard constraints |

Algorithm id: `edge.p7.placement.v1` / default version `1.0.0`.
