# 19 — Runbooks chemins critiques (E12 beachhead)

## Provision → ready

1. Commercial grant + subscription create
2. Billing confirm (payment SUCCEEDED fail-closed)
3. Activate subscription
4. Association Subscription↔Product Tenant ACTIVE
5. Publish entitlements → BB ; drift-scan clean
6. `ready=true` only when projection non vide

## Dunning

1. Open collection → `apply-policy` → PAST_DUE / restriction
2. Notify (`…/collections/:id/notify`)
3. Escalate → SUSPEND + BB suspend
4. Resolve → REACTIVATE + BB resume (payment health restored)

## Drift entitlements

1. `drift-scan` ops
2. Reconcile / republish — never silent expansion beyond grant
3. Adversarial tests green

## Incident billing

1. Cash-truth contracted ≠ invoiced ≠ collected
2. No activation without SUCCEEDED payment
3. HyperSwitch = orchestration only

## CS / renewal

1. Aha ingest BB → Edge
2. Health + churn risk
3. Renewal playbook ; expansion = quote only

## Anti-patterns RGOM (ops)

1. Multi-produits dans un même Product Tenant
2. `entitlements: {}` en prod / `lab_bb` en production
3. Silent entitlement bump (expansion sans quote)
4. Login = activation / Aha
5. Inventer prix / TAM / MEASURED cash sans lignée P6
6. Capability `PLANNED` vendue comme Available
7. Commission approve = payout automatique
8. Configurator `grantsEntitlements: true`
