# P2 commercial events

## Events
| Event type | When |
|------------|------|
| `commercial.market.created.v1` | Market registered |
| `commercial.icp.created.v1` | ICP created |
| `commercial.segment.prioritized.v1` | Segment scored (not NEEDS_RESEARCH) |
| `commercial.package.published.v1` | Solution package published |
| `commercial.pricebook.published.v1` | Price book published |
| `commercial.offer.readiness.evaluated.v1` | After commercial readiness evaluation |
| `commercial.offer.published.v1` | After plan publication snapshot |

Producer: `okapi-edge`  
Outbox tenant sentinel: `edge-control-plane`  
Store: Control Plane outbox (`ControlPlaneOutboxTransactionService`)

`RoutingEventPublisher` routes `commercial.*` to the control-plane outbox.

## Payload guarantees
- No secrets
- Includes offer/product ids, snapshot id, readiness result
- Does not create subscriptions (P6) or invoices (P7)

## Future consumers (contracts only)
P3 marketing, P4 CRM, P5 contracts, P6 entitlements, P7 billing, P8 CS, P9 RevOps — not implemented in P2.
