# 08 — Implementation Roadmap

## Vague 1 — Fondation (P8.0–P8.4)

1. Docs préaudit (ce dossier)
2. Migration `108_edge_p8_advanced_tenant_management.sql`
3. Domain types + policies + repository port
4. Registry CRUD/search + sync from P7 activation/lifecycle
5. 360 overview aggregators (commercial/technical projections)
6. Admin metadata / tags / assignments
7. Lifecycle governance requests (+ dual approval hooks)
8. RBAC permissions `platform:tenant_management:*`
9. API + authz tests
10. Console registry + detail overview

## Vague 2 — Gouvernance (P8.5–P8.13)

- Configuration preferences
- Resource/application projections
- Health snapshots + freshness
- Risk assessments
- Exceptions + approvals
- Migration / recovery / termination requests
- Retention guards (legal hold)

## Vague 3 — Intelligence & Console (P8.14–P8.19)

- Reconciliation engine + findings
- Activity/audit explorer
- Analytics snapshots + reports
- Full Admin Console workspaces
- Bulk operations with preview

## Vague 4 — Certification (P8.20–P8.21)

- Events outbox/inbox
- Security / performance / E2E evidence
- Acceptance report + SHAs

## Dépendances

| Capacité | Dépend de |
|---|---|
| 360 commercial | P5/P6 ports disponibles |
| Lifecycle exécution | P7.11 workflows |
| Migration/recover exécution | Extension P7.11 API (gouvernance P8 peut précéder) |
| Health réel | Observations P7 ; sinon STALE/UNKNOWN |

## Git

- Branche `feature/console` sur backend et frontend
- Commits atomiques par sous-phase stable
- Ne pas écraser le WIP onboarding (107) non lié
