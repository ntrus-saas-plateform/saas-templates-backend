# P9 — Known limitations (honest)

1. **P9.12 incomplete for ACCEPTED** — cohérence FE/BE + auth/smoke OK ; gates A–J, chaos, scale, E2E authentifié complets non clos.
2. **No live provider adapters** — Prometheus / Alertmanager / Grafana / OTEL = registry rows ; overview marque `UNAVAILABLE` si `NOT_CONFIGURED`.
3. **Health snapshots** — `HEALTHY` seulement avec `sourceSystem` trusted (`p7.|probe.|otel.|prometheus.|system.`).
4. **Automation execute** — audit + statut durable ; n’invoque pas de runtime externe.
5. **On-call** — rotations stockées ; pas de paging/delivery.
6. **Status** — workflow SoD interne ; aliases `status-pages` → components ; pas de CDN public.
7. **Releases** — alias de `changes` (pas de table release séparée).
8. **Major incidents** — alias `major-incidents` + `incidents/:id/major` + filtre `isMajor`.
9. **Service catalog** — registry configuré, pas d’auto-discovery P7.
10. **Migration 116** doit être appliquée avant usage runtime.
11. **Pas d’E3 Testcontainers** dédié pour mig 116.
