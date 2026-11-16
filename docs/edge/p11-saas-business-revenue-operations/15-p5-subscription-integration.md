# 15 — P5 subscription integration

## Direction

```
P5 subscription revenue lines --projection--> P11 MRR calculator / snapshots
P11 --X--> never writes subscriptions/entitlements
```

Default adapter: `StubRevenueProjectionAdapter` returns `[]` → UNAVAILABLE until real adapter wired.

Soft refs only: `subscription_ref_id`, `product_ref_id`, `commercial_plan_ref_id`.
