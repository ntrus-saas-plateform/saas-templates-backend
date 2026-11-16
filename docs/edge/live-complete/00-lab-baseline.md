# 00 — Lab baseline (live-complete)

Frozen SHAs for the Edge live-complete pilot lab. Branch: `feature/console`.

| Repo | Local HEAD (lab) |
|------|------------------|
| Backend `saas-templates-backend` | `a761c0b95af7f04643427ca3669a69bbb5c06183` |
| Frontend `saas-template-frontend` | `c256f16a72107e492ecf0f73524cef26164e3a34` |

## Push / remote note

Push to `origin/feature/console` as `kabikaAsyst` historically returns **HTTP 403** (permission denied). A third party cloning remote alone will **not** see recent P5–P11 / live-complete work until an authorized push or mirror succeeds. Treat local SHAs above as the lab SoT until remote catches up.

## Lab compose services

From `saas-templates-backend/docker-compose.yml` (plus BB Nest and Edge Console run separately when needed):

| Service | Role |
|---------|------|
| `postgres` | Control-plane DB (`platform_control`) |
| `postgres-tenant-a` / `postgres-tenant-b` | Optional tenant DB sandboxes |
| `redis` | Cache / billing locks |
| `rabbitmq` | Outbox / events |
| `vault` | Optional secrets (dev) |
| `keycloak` | Identity (realm import) |
| `platform` | Edge API |

Also required for golden path: **edge-business-backend** (BB control/v1) and **saas-template-frontend** console on `feature/console`.

## Required env for live path

See copy-paste block: [`01-env-lab.example.md`](./01-env-lab.example.md).

Critical switches:

- `BILLING_PAYMENT_ADAPTER=sandbox`
- `EDGE_P7_PROVISIONING_ADAPTER=lab_bb` (lab complete BB path; use `durable` only with canonical P5 auth)
- `EDGE_BB_CONTROL_BASE_URL` / `EDGE_BB_CONTROL_TOKEN` / `EDGE_BB_CONTROL_ALLOW_INSECURE_HTTP=true` (lab HTTP)
- `EDGE_PCI_*` (product-control credentials / insecure HTTP / timeout as needed for BB endpoints)
- Keycloak: `KEYCLOAK_*` + admin clients (compose defaults or `.env.example`)

## Migrate checklist

1. Start Postgres (compose `postgres` healthy).
2. Apply control-plane migrations: `pnpm migrate:control` (includes P5 `087+`, P6 `090+`, P7/P8, P9 `115+`, P10 `117+`, P11 `122+`, lab Pharmacy seed `124` through current HEAD).
3. Seed Pharmacy product for live-complete (idempotent):

```bash
pnpm exec tsx scripts/seed-live-complete-pharmacy.ts
# or
pnpm seed:live-complete
```

   Prints the product id. Reuses an existing Pharmacy / `PHARMACY_LIVE` product when present. Migration `124_edge_live_complete_pharmacy_seed.sql` also inserts if missing during `migrate:control`.
4. Start BB Nest; confirm control/v1 reachable with lab token.
5. Start Edge `platform` with live-path env; start console FE.

## Smoke liveness

- Edge: `GET /liveness` → 200
- BB: control/v1 health / ready endpoints with M2M token (non-200 when DOWN)

## Golden path (Pharmacy) — one-liner

**Acquisition Pharmacy → P5 subscription handoff → sandbox payment PAID → durable P7 provision (KC + DB + BB) → tenant ACTIVE → portal `provisioningComplete=true` only from BB `GET /control/v1/tenants/:id/ready`.**
