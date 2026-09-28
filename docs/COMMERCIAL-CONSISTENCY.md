# Commercial Consistency

## Synchronous (strong consistency)

These paths must reflect durable truth before the API returns:

| Domain | Why sync |
|--------|----------|
| Order confirm / cancel / allocate status | Customer commitment |
| Inventory reserve / allocate / receive / issue / adjust | Stock SoT |
| Payment capture / refund | Money movement |
| Invoice post | Immutable fiscal document |
| Purchase receive | On-hand increases with PO |

## Eventual (async / projected)

| Surface | Mechanism | Notes |
|---------|-----------|-------|
| Analytics / KPIs | Jobs + snapshots | Lag OK |
| Dashboards | `rm_*` / dashboard projections | Refresh jobs |
| Notifications | `commercial_notification_outbox` | Multi-channel |
| Search | Index / query projections | Not SoT |
| AI forecasts / insights | Snapshots + heuristics | Never mutate stock |
| Copilot reads | Compose ports + read models | Graceful empty |
| Webhooks | Signed delivery + retries | External eventual |

## Rule of thumb

> If money or sellable stock changes, it is **sync**. If a UI tile, search hit, or AI tip changes, it is **eventual**.
