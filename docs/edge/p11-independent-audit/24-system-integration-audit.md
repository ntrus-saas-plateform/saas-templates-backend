# 24 — Audit intégrations systèmes (P11)

| Champ | Valeur |
|-------|--------|
| P5 | Lecture subscriptions (projection, renewals, assurance) |
| P6 | Lecture invoices (assurance) ; **pas** engine collected |
| Verdict | Intégration **read-only partielle** |

## Adapters (E3)

| Adapter | Rôle | Limite |
|---------|------|--------|
| `live-revenue-projection.adapter.ts` | P5 → lignes MRR | STARTING/ENDING only ; payment UNKNOWN |
| `stub-revenue-projection.adapter.ts` | Stub | Empty / UNAVAILABLE |
| `p5-p6-assurance.adapter.ts` | Cross-check sub/invoice | Pas de payments collected aggregator |

## Absences d’intégration

| ID | Sévérité | Gap |
|----|----------|-----|
| F-P11-001 | P0 | Pas d’intégration exécutable P6 payments → COLLECTED |
| F-P11-025 | P2 | Pas d’adapter recognized revenue / accounting SoT |
| F-P11-007 | P1 | Pas d’intégration FX rates |
| F-P11-014 | P1 | Pas de preuve Testcontainers d’intégration DB |

## Boundary

Aucune écriture inverse vers P5/P6 — **PASS** ([02](./02-architecture-boundaries-audit.md)).

## Verdict

Intégrations **suffisantes pour MVP analytique**, **insuffisantes** pour assurance cash enterprise.
