# P9 — Implementation report

**Date :** 2026-11-16  
**Verdict :** `P9 PARTIALLY IMPLEMENTED` (P9.0–P9.11 core + P9.12 partiel)

## Delivered

### P9.0
- Baseline audit des deux repos (remotes réels, HEAD, migrations, absences ops)
- Architecture, bounded contexts, plan, known limitations

### P9.1
- Migration `115_edge_p9_service_catalog.sql`
- Domaine / use-cases / PG repo / controller / RBAC
- Console `/edge/operations` + nav shell

### P9.2–P9.11 (operations core)
- Migration `116_edge_p9_operations_core.sql` (tables + permissions `platform:operations:*`)
- Domain types, events (`edge.p9.*`), policy state machines, repository port
- `PgOperationsRepository` — SQL réel contre `edge_p9_*` (alert fingerprint dedup, numéros INC/CHG/PRB/REQ)
- Use cases avec policy asserts + outbox + audit durable
- Routes `edge/operations/*` (alerts, incidents, problems, changes, maintenance, requests, tasks, on-call, SLO, capacity, recovery, runbooks, status, risks, exceptions, automation, analytics)
- List GET alignés FE : problems, recovery, status/components, risks, exceptions
- Overview / analytics : **comptages DB réels** ; intégrations monitoring marquées `UNAVAILABLE` si source `NOT_CONFIGURED`
- Garde-fous : pas de HEALTHY sans source trusted ; pas de VERIFIED recovery sans evidence ; SoD change/status/automation ; pas de deletes silencieux

### Console FE
- Operations Center 16 onglets (API-driven, pas de métriques inventées)
- Client `edgeApi` aligné chemins BE (ack→acknowledge, root-cause, link incidents, slo/measurements, automation singulier)
- Unit tests module + smoke Playwright (gate sign-in + CSRF reject)

### P9.12 (partiel)
- Auth matrix controller étendue (routes list + mutations)
- Alignement FE/BE des list endpoints
- Smoke E2E CSRF / anonymous — **pas** matrice A–J production complète
- Pas d’E3 Testcontainers dédié migration 116 dans cette vague

## Not delivered / blocked for ACCEPTED
- Adapters providers (Prometheus, Alertmanager, Grafana, OTEL) — registry only
- Delivery on-call / notifications push
- Public status-page CDN
- Full authenticated E2E matrix + chaos/scale gates
- Auto-discovery catalogue depuis P7

## Migrations
- `115_edge_p9_service_catalog`
- `116_edge_p9_operations_core`

## Tests (unit) — dernière run locale
- BE ops policy + use-cases + auth controller : **74 passed**
- FE `edge-operations-module` : **4 passed**
