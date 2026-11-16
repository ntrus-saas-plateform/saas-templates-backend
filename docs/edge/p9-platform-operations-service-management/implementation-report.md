# P9 — Implementation report

**Date :** 2026-11-16  
**Verdict :** `P9 PARTIALLY IMPLEMENTED` (P9.0–P9.11 core + P9.12 cohérence FE/BE)

## Commit SHAs (feature/console, local — not pushed)

| Repo | SHA | Message |
|------|-----|---------|
| Backend (P9.1) | `59eab9a` | service catalog foundation |
| Frontend (P9.1) | `d6becd6` | catalog console + nav |
| Backend (ops core) | `23366ad` | P9.2–P9.11 operations core |
| Frontend (ops UI) | `6a278b8` | Operations Center + API align |
| Backend (docs SHAs) | `7cb2c5d` | record SHAs |

*(SHAs de la vague cohérence FE/BE : voir commits suivants sur `feature/console`.)*

## Delivered

### P9.0–P9.1
- Baseline + service catalog mig 115 + console

### P9.2–P9.11
- Migration `116_edge_p9_operations_core.sql`
- Domain / policy / PG repo / use-cases / routes `edge/operations/*`
- List pages normalisées `{ items, total }` (y compris on-call, SLO, capacity, runbooks, automation)
- Overview/analytics = agrégats DB réels ; monitoring `UNAVAILABLE` si `NOT_CONFIGURED`
- SoD change / status / automation ; recovery VERIFIED exige evidence ; pas de HEALTHY inventé

### Cohérence FE ↔ BE (vague finale)
- Client `edgeApi` couvre toutes les routes mutatives + listes + aliases mandat
- Types overview alignés sur `OperationsOverviewAggregate`
- Bodies alignés : `reject.reason`, `publish.componentCode/DisplayName`, capacity `observedAt` optionnel
- Query `isMajor` sur incidents ; `GET automation` ; aliases `health`, `major-incidents`, `releases`, `status-pages`
- Console : badges overview corrects, actions ligne (ack/resolve/transition/major/SoD change), forms create manquants, verify recovery, publish status, liste automations
- Shell : nav Operations filtrée par permissions

### P9.12 (partiel)
- Auth matrix étendue (aliases + automation:read)
- Smoke FE + unit auth — **pas** gates A–J production complets

## Not delivered / blocked for ACCEPTED
- Adapters Prometheus / Alertmanager / Grafana / OTEL live
- Paging on-call / notifications
- Status page CDN public
- E3 Testcontainers mig 116
- Full authenticated E2E matrix / chaos / scale

## Tests (dernière run locale cohérence)
- BE ops policy + use-cases + auth : **79 passed**
- FE `edge-operations-module` : **5 passed**
