# 47 — Import Grafana provisioning H1/H2

## Artefacts

- Dashboard : [grafana-provisioning-h1-dashboard.json](./grafana-provisioning-h1-dashboard.json) (uid `edge-prov-h1`, v2)
- Alertes : [45-provisioning-slo-alerts.md](./45-provisioning-slo-alerts.md)

## Procédure

1. Scrape Prometheus **Edge** : `edge_provisioning_jobs_pending|lag_seconds|processed_total|duration_seconds`.  
2. Scrape Prometheus **BB** : `bb_warm_pool_ready`, `bb_warm_pool_claims_total`, `bb_tenant_db_allocate_duration_seconds`.  
3. Grafana → Dashboards → Import → coller le JSON.  
4. Mapper datasource(s) (Edge + BB, ou federation).  
5. (Optionnel) Alertmanager : groupe YAML doc 45.  
6. Activer worker Edge : `EDGE_PROVISIONING_JOBS_ENABLED=true` (warm pool reste OFF jusqu’à refill).

## Vérif

- Tick worker → `edge_provisioning_jobs_processed_total` monte.  
- `edge_provisioning_jobs_pending` + `lag_seconds` = backlog SQL (pas seulement le batch claimé).  
- Allocate BB → histogramme `mode=cold_create|warm_claim` (warm seulement si flag ON).  

Pas de claim d’échelle : voir [40](./40-provisioning-scale-architecture.md).
