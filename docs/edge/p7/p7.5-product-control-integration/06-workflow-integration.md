# P7.5 — Workflow Integration (P7.4)

Foundation handlers (real):

- `product_control.handshake`
- `product_control.discover_contract`
- `product_control.discover_capabilities`
- `product_control.verify_connectivity`
- `product_control.verify_health`
- `product_control.verify_conformance`

Behavior: succeed from a validated discovery snapshot in step input, **or** call live use cases via `PRODUCT_CONTROL_LIVE_EXECUTOR` when `endpointId` is present.

Mutative / future keys stay `OPERATION_NOT_IMPLEMENTED` (`p7.5.product_control.provision|activate`, `p7.6.*`, `p7.7.*`, `unavailable:p75|p76|p77`).
