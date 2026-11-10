# P7.4 — Runbook

## Migrate

```bash
npm run migrate:control
# Applied 099_edge_p7_durable_workflow_engine
```

## Worker

- Bootstrap `WorkflowWorkerBootstrap` via JobScheduler `every:Ns`
- Handler exécuté hors TX ; outcome persisté avec fencing
- Handlers disponibles : `noop:checkpoint`, `noop:approve` ; `unavailable:p75|p76|p77` échouent toujours

## Ops console

`/edge/provisioning/workflows` — Dashboard / Definitions / Instances / Tasks / Workers

## Reconciliation

`POST /workflows/:id/reconcile` — leases expirés, retries dus, tâches expirées, auth révoquée → hold

## Incident stale worker

1. Vérifier `fencing_token` / `lease_expires_at`
2. Ne pas accepter un complete avec token inférieur
3. Relancer reconcile
