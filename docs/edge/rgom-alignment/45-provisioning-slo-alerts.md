# 45 — Alertes SLO provisioning (H1)

**Statut :** RULES DRAFT — brancher sur Prometheus/Grafana ops  
**Métriques code :**  
- Edge : `edge_provisioning_jobs_*` (+ `lag_seconds`)  
- BB : `bb_warm_pool_ready`, `bb_warm_pool_claims_total`, `bb_tenant_db_allocate_duration_seconds`

```yaml
groups:
  - name: edge-provisioning-h1
    rules:
      - alert: EdgeProvisioningJobsFailRateHigh
        expr: |
          sum(rate(edge_provisioning_jobs_processed_total{result=~"FAILED|DEAD_LETTER"}[15m]))
          /
          clamp_min(sum(rate(edge_provisioning_jobs_processed_total[15m])), 1e-9)
          > 0.05
        for: 15m
        labels: { severity: warning }
        annotations:
          summary: Provisioning job fail rate > 5% (15m)

      - alert: EdgeProvisioningJobsPendingHigh
        expr: edge_provisioning_jobs_pending > 100
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: Provisioning job backlog > 100

      - alert: EdgeProvisioningJobsLagHigh
        expr: edge_provisioning_jobs_lag_seconds > 120
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: Oldest pending/failed job age > 120s

      - alert: EdgeProvisioningJobP95Slow
        expr: |
          histogram_quantile(0.95,
            sum(rate(edge_provisioning_jobs_duration_seconds_bucket[15m])) by (le, job_type)
          ) > 180
        for: 15m
        labels: { severity: info }
        annotations:
          summary: p95 job duration > 180s (cold create expected; not a 50k claim)

      - alert: BbWarmPoolDepthLow
        expr: sum(bb_warm_pool_ready) < 3
        for: 10m
        labels: { severity: info }
        annotations:
          summary: Warm pool READY depth < 3 (only meaningful if BB_WARM_POOL_ENABLED)
```

Activer worker : `EDGE_PROVISIONING_JOBS_ENABLED=true` + `EDGE_PROVISIONING_ADVANCE_MODE=deferred`.  
Warm pool : `BB_WARM_POOL_ENABLED=true` seulement après refill template versionné (`pnpm warm-pool:refill`, défaut OFF). Option prod : `BB_WARM_POOL_REQUIRE_CLAIM=true` si pool vide.

## Grafana

Importer [grafana-provisioning-h1-dashboard.json](./grafana-provisioning-h1-dashboard.json) (uid `edge-prov-h1`) — panels H1 jobs + H2 warm/cold.  
Datasource : Prometheus Edge **et** scrape BB (métriques `bb_*`). Import ops = étape humaine ([47](./47-grafana-import-runbook.md)).
