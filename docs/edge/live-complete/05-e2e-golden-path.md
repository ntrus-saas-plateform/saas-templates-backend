# 05 — E2E golden path (Phase 5)

Honest label: this pack is the **lab runbook + contract suite** for the Pharmacy live-complete path. Automated coverage in-repo is the **E2/E3 golden-path contract suite** (`live-complete-golden-path.spec.ts`). Full docker/console E2E is **NEED_LAB_RUN** — do not treat green Vitest alone as live docker PASS.

## Lab env (required)

```bash
BILLING_PAYMENT_ADAPTER=sandbox
EDGE_P7_PROVISIONING_ADAPTER=durable
EDGE_BB_CONTROL_BASE_URL=http://host.docker.internal:3100   # or lab BB URL
EDGE_BB_CONTROL_TOKEN=lab-edge-control-token
EDGE_BB_CONTROL_ALLOW_INSECURE_HTTP=true
```

See [`01-env-lab.example.md`](./01-env-lab.example.md) and [`00-lab-baseline.md`](./00-lab-baseline.md).

## How to run

| Layer | Command / action |
|-------|------------------|
| E2/E3 contracts (no docker claim) | `pnpm vitest run src/modules/edge/application/live-complete/live-complete-golden-path.spec.ts` |
| Lab smoke (opt-in) | `LIVE_COMPLETE_E2E=1 EDGE_API_URL=http://localhost:3000 pnpm test:e2e -- test/e2e/live-complete-smoke.e2e-spec.ts` |
| Manual scenarios 1–10 | Compose lab up + migrate + seed Pharmacy; follow steps below; record evidence in [`05-e2e-evidence-template.md`](./05-e2e-evidence-template.md) |

---

## Scenario 1 — Console ops golden path

| | |
|--|--|
| **Preconditions** | Lab compose healthy; Pharmacy product + plan seeded; sandbox + durable + BB URL set; console auth as ops |
| **Steps** | Create commercial deal → create/bind subscription → raise invoice → pay via sandbox → enqueue durable provision → wait readiness (KC + DB + BB) → tenant ACTIVE |
| **Expected** | P6 paid from sandbox proof; P7 provision evidence SUCCESS; P8 tenant ACTIVE; no `Unavailable*` on critical path |
| **Run** | Console `/edge` + APIs; correlation IDs in evidence template |

## Scenario 2 — Acquisition publique P10 → handoff

| | |
|--|--|
| **Preconditions** | Public acquisition enabled for Pharmacy; same live adapters as S1 |
| **Steps** | Public lead/checkout → quote accept → subscription handoff → payment → provision → portal snapshot |
| **Expected** | Handoff COMPLETED with `tenantRef`; `provisioningComplete=true` only after BB `GET /control/v1/tenants/:id/ready` → `ready: true` |
| **Run** | Portal + Edge API; contract covered partially by portal unit tests |

## Scenario 3 — Renewal / change plan (P5) + re-billing

| | |
|--|--|
| **Preconditions** | Active paid subscription from S1/S2 |
| **Steps** | Change plan or renew → new invoice → sandbox pay → ledger PAID |
| **Expected** | New payment intent confirmed; subscription reflects new plan; no invented PAID |
| **Run** | Console subscriptions + billing |

## Scenario 4 — Suspend / resume

| | |
|--|--|
| **Preconditions** | ACTIVE tenant + subscription |
| **Steps** | Suspend (authorized ops) → verify access/billing state → resume |
| **Expected** | Suspended state durable; resume restores ACTIVE without fake provision SUCCESS |
| **Run** | Console tenants/subscriptions lifecycle actions |

## Scenario 5 — Deprovision authorize (SoD)

| | |
|--|--|
| **Preconditions** | Two distinct ops identities (requestor ≠ authorizer) |
| **Steps** | Request deprovision → second actor authorizes → execute |
| **Expected** | SoD enforced; unauthorized alone cannot complete; evidence redacted |
| **Run** | Console provisioning / tenant lifecycle |

## Scenario 6 — Replay webhook paiement (idempotence)

| | |
|--|--|
| **Preconditions** | Known payment webhook (or sandbox confirm) already applied once |
| **Steps** | Replay same provider event / idempotency key |
| **Expected** | Second apply idempotent; ledger not double-paid |
| **Run** | Billing webhook endpoint or sandbox confirm replay |

## Scenario 7 — Indisponibilité BB → pas de faux SUCCESS

| | |
|--|--|
| **Preconditions** | Stop BB or unset `EDGE_BB_CONTROL_BASE_URL` |
| **Steps** | Trigger product_control.provision / activate |
| **Expected** | `DEPENDENCY_UNAVAILABLE` / FAILED; never SUCCESS; portal `provisioningComplete` stays false |
| **Run** | Contract: client/executor unit; lab: kill BB |

## Scenario 8 — Indisponibilité PSP → abo non activé

| | |
|--|--|
| **Preconditions** | `BILLING_PAYMENT_ADAPTER=unavailable` (or PSP down) |
| **Steps** | Attempt pay / confirm |
| **Expected** | Outcome `UNAVAILABLE`; subscription not activated as paid; sandbox never auto-selected |
| **Run** | Contract: ResolvingPaymentProviderAdapter unit; lab: flip env |

## Scenario 9 — Permission deny export/billing

| | |
|--|--|
| **Preconditions** | User without billing/export roles |
| **Steps** | Call billing export / sensitive billing mutations |
| **Expected** | 403 / access denied; no data leak |
| **Run** | Console + API with restricted JWT |

## Scenario 10 — Reconciliation P7 après outage

| | |
|--|--|
| **Preconditions** | Provision interrupted mid-flight (BB or workflow outage) |
| **Steps** | Restore deps → run P7 reconciliation / resume workflow |
| **Expected** | Converges to READY/ACTIVE or explicit FAILED with evidence; no silent invent SUCCESS |
| **Run** | Lab outage drill + P7 reconciliation UI/API |

---

## Mapping to automated contracts (E2/E3)

| Scenario focus | Automated? |
|----------------|------------|
| S1 payment happy path (sandbox create→confirm→fetch) | Yes — unit |
| S7 BB missing URL | Yes — client/executor contract |
| S8 resolver never uses sandbox when unavailable | Yes — unit |
| Portal flag vs ready port | Yes — unit |
| Full S1–S10 docker + console | **No in CI default** — NEED_LAB_RUN |
