# Commercial readiness (Increment 1)

P1 = technical readiness. P2 = commercial readiness. Independent gates.

## Checks executed today
1. Product lifecycle must be `PUBLISHED` (configurable via profile rules).
2. Plan must have a tier.
3. If a price book is attached, currency must be present.
4. Included capabilities must exist in P1 and pass commercial inclusion rules (not `PLANNED`/`IN_PROGRESS`/`BLOCKED`, not `UNAVAILABLE`).

## Results
`NOT_READY` | `NEEDS_REVIEW` | `READY` | `BLOCKED`

## Hard gate
`assertPublicationAllowed` rejects `BLOCKED` and `NOT_READY` before writing `edge_commercial_publication_snapshots`.

## Storage
Evaluations are append-only in `edge_commercial_readiness_evaluations`.
