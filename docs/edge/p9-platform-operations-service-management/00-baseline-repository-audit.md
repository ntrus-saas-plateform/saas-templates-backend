# P9.0 — Baseline repository audit

**Date :** 2026-11-16  
**Branche :** `feature/console`

## Git

| | Backend | Frontend |
|--|---------|----------|
| Remote | `ntrus-saas-plateform/saas-templates-backend` | `ntrus-saas-plateform/saas-template-frontend` |
| HEAD (baseline) | `280570e` | `0c86ac7` |
| Ahead of origin | 24 | 13 |
| Working tree | clean (hors artefacts locaux) | clean |

**Note :** le mandate mentionnait parfois `saas-templates-frontend` ; le remote réel est **`saas-template-frontend`**. Aucun nouveau dépôt créé.

## Migrations control-plane

- Dernière : `114_edge_p8_residual_enterprise_closure.sql`
- Prochaine P9 : **`115_edge_p9_*`**
- Convention : `{NNN}_edge_{pN|domaine}_{slug}.sql`

## Modules Edge existants (réutilisation)

| Domaine | Rôle vs P9 |
|---------|------------|
| `tenant-management` (P8) | Consommé pour impact tenant / risques — **pas** dupliqué |
| `tenant-lifecycle`, provisioning, workflow, infra, keycloak (P7) | Sources d’observation / remédiation via APIs — **pas** moteur P9 |
| `subscription` / billing (P5/P6) | Contexte commercial en lecture seule si besoin |
| `platform` health/metrics | Liveness/readiness + Prometheus — étendre, ne pas remplacer |
| OTEL `instrumentation.ts` | Observabilité partagée (ADR-P7-011) |

## Absents (à construire)

Aucun module `operations` / `incident` / `alert` / `oncall` / `slo` / `runbook` / `status-page` sous `src/modules/edge`.  
Aucune nav Console « Operations ».  
Aucun `platform:operations:*` / `platform:service_catalog:*`.

## Patterns à réutiliser

- Hexagonal : `domain` / `application` / `infrastructure` / `presentation`
- `RequireEdgePermissions('platform:<domain>:<action>')` + SoD request/approve
- `ControlPlaneOutboxTransactionService` + `AuditEventRepositoryPort` fail-closed
- Inbox dedup pour ingestion alertes
- Console : `edge-shell`, `EdgePermissionGate`, React Query, `edgeApi`, patterns P8 tenant-management

## Notifications

Identity push / fanout + canaux marketing — adapters à brancher ; **pas** de preuve de livraison = succès.

## Frontend nav actuelle

Portfolio → Catalog → Commercial → … → Tenant Management → Billing → Provisioning\* → … → Audit.  
**Pas** d’entrée Operations.

## Verdict baseline

**Prêt pour P9.1** — greenfield Platform Ops sur socle Edge existant, sans remplacement de sous-systèmes opérationnels incomplets (aucun stub P9 à étendre).
