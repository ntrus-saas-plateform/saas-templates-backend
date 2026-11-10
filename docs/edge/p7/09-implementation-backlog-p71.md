# P7.0 → P7.1 Backlog (post-G0 only)

**Do not execute until Gate G0 approved.**

## P7.1 — Authorization Foundation (first build slice)

### Backend

1. Domain: `ProvisioningAuthorization`, `ProvisioningRequest` (+ history)
2. Migrations: `provisioning_authorizations`, `provisioning_requests`, `provisioning_request_history`, constraints, events outbox refs
3. Link to P5: subscription id, correlation id, entitlement snapshot ref; dual-write or replace coordination with clear mapping from `edge_subscription_provisioning_requests`
4. Implement `SubscriptionProvisioningCoordinationPort` adapter → creates durable P7 request (no infra)
5. Consumer: authorization + revocation handlers
6. Idempotency on authorization id / correlation
7. APIs: list/get/history/cancel (operator RBAC `platform:provisioning:*`)
8. Audit + structured logs
9. Unit + integration tests per plan §5.4

### Frontend (parallel once list API stable)

1. Enable nav entry (Provisioning Requests — not fake Tenant CRUD)
2. List + detail + history drawers
3. Empty/error/loading states; no workflow UI yet

### Explicit non-goals for P7.1

- Placement, capacity, workflow engine, BB calls, Keycloak, DB create, activation UI

### Exit (Gate G1)

Valid P5 authorization → durable idempotent request; **zero** technical resources created.
