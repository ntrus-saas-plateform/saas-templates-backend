# 40 — Architecture d’échelle provisioning (H0→H3)

**Date :** 2026-11-18  
**Statut :** DESIGN + fondation H1 en code (jobs) — **aucun claim chiffré public**  
**Liens :** [39](./39-master-improvement-alignment-plan.md) · [38](./38-verticals-and-provisioning-scale-audit.md) · [33](./33-load-smoke-provision-ready.md)

---

## 1. Distinction critique

| Terme | Signification | Ordre de grandeur réaliste |
|-------|---------------|----------------------------|
| **Cold create** | `CREATE DATABASE` + migrations tenant (~143) + Keycloak + profile | ≪ 1–quelques / s / cluster |
| **Allocation** | Claim d’une DB déjà migrée depuis un **warm pool** / template | 10²–10³ / s (cible H2, à mesurer) |
| **Ready poll** | GET statut provision | plus élevé ; hors scope « provision create » |

> **50 000/s** n’est crédible **que** comme débit d’**allocation** de pool (ms), jamais comme cold create synchrone.

Patterns industrie retenus : warm pool pré-migré + `CREATE DATABASE … TEMPLATE` (PostgreSQL) ; state machine fail-closed (creating → active seulement après migrations + registry) ; pool inclus dans chaque release migration pour éviter le drift.

---

## 2. Pipeline cible (checkpoints)

```
PAID
  → enqueue REQUEST_PROVISION (optionnel)
  → BB control/v1 provision (async worker)
  → POLL_READY (retry borné)
  → PUBLISH_ENTITLEMENTS
  → ACTIVATE_SUBSCRIPTION
```

Table Edge : `edge_provisioning_jobs` (migration **134**).  
Modes : `EDGE_PROVISIONING_ADVANCE_MODE=inline|deferred`.  
Worker tick : `POST /api/v1/edge/provisioning-jobs/process`.

---

## 3. Horizons

| Horizon | Objectif | Preuve requise |
|---------|----------|----------------|
| **H0** | Beachhead correct + deferred advance | docs 36–37 ; e2e lab |
| **H1** | 10–50 cold provisions / min | concurrence bornée + métriques queue |
| **H2** | 10²–10³ **allocations** / s | warm pool BB + template DB versionné |
| **H3** | Claim public chiffré | benchmark lab signé + capacity plan |

---

## 4. SLO / métriques (à instrumenter — pas encore certifiés)

| Métrique | Description | Alerte (brouillon) |
|----------|-------------|-------------------|
| `edge_provisioning_jobs_pending` | profondeur file (SQL backlog) | > 100 pendant 5 min |
| `edge_provisioning_jobs_lag_seconds` | âge du plus vieux PENDING/FAILED | > 120 s |
| `bb_tenant_db_allocate_duration_seconds{mode}` | cold_create / warm_claim | p95 > 180 s (info) |
| `edge_provisioning_jobs_processed_total` fail rate | FAILED+DEAD_LETTER / total | > 5 % / 15 min |
| `bb_warm_pool_ready` (H2) | DB READY par template_version | < 3 (si flag ON) |

---

## 5. Warm pool BB (H2 — design only)

1. Maintenir N DB clonées depuis `template_tenant_v{migrationHash}`.  
2. À l’allocation : rename/claim + register control-plane + apply delta migrations si hash diverge.  
3. Inclure le pool dans **chaque** migration fleet (sinon drift).  
4. Fail-closed : jamais router le trafic tant que status ≠ ready.  
5. Coût idle vs débit — activer seulement si onboarding dédié fréquent.

---

## 6. Anti-claims

- ❌ « On tient 50k provisions/s » sans benchmark H3  
- ❌ Confondre ready-poll QPS et cold create  
- ❌ Marquer Product Tenant AVAILABLE pour scaler le marketing avant G11  

---

## 7. Exit criteria Phase E (doc 39)

- [x] Worker concurrence configurable (`EDGE_PROVISIONING_JOBS_*`)  
- [x] Métriques Prometheus : `edge_provisioning_jobs_*` (+ lag)  
- [x] Dashboard JSON + alertes YAML prêts ([45](./45-provisioning-slo-alerts.md), [47](./47-grafana-import-runbook.md)) — **import ops encore manuel**  
- [ ] Load smoke N≥50 async (pas sync monolith) documenté  
- [ ] H1 mesuré en lab et collé ici avec date + env  

## 8. Warm pool BB (H2 scaffold — 2026-11-18)

| Artefact | Statut |
|----------|--------|
| Table `tenant_warm_pool` | mig BB **133** |
| `claimWarmPoolDatabase` + rename | `tenant-warm-pool.ts` |
| Hook allocation | si `BB_WARM_POOL_ENABLED=true` : claim + rename ; pool vide → **cold CREATE** (défaut) ou `DEPENDENCY_UNAVAILABLE` si `BB_WARM_POOL_REQUIRE_CLAIM=true` |
| Métriques | `bb_warm_pool_ready`, `bb_warm_pool_claims_total`, `bb_tenant_db_allocate_duration_seconds` |
| Refill script | `pnpm warm-pool:refill` — `WARM_POOL_TEMPLATE_VERSION`, `WARM_POOL_MIGRATION_HASH`, template DB `template_tenant_<version>` (override `WARM_POOL_TEMPLATE_DB`) ; `WARM_POOL_LIST=true` pour lister |
| Refill / template fleet réel | **TODO** ops (hash + benchmark) |
| `BB_WARM_POOL_ENABLED` | défaut **false** — ne pas activer prod sans refill versionné |
| Benchmark allocation QPS | **interdit** de claim sans H3 |
