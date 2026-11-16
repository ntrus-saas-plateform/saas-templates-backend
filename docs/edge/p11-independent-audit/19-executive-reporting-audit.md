# 19 — Audit reporting exécutif (P11)

| Champ | Valeur |
|-------|--------|
| API | `GET/POST edge/business/reports`, overview |
| Console | Onglet Reports PRESENT |
| Verdict | Reporting **MVP** ; pack exécutif 30 sections **FAIL** |

## Présent (E3)

- `listBusinessReports` / `generate` avec permissions `platform:business:read` / `reports:manage`
- Overview revenue + business overview endpoints
- Data quality cells plutôt que zéros inventés (doctrine)

## Risques

| ID | Sévérité | Risque |
|----|----------|--------|
| F-P11-001 | P0 | Rapport exécutif peut afficher snapshots COLLECTED injectés sans moteur |
| F-P11-010 | P1 | Overview visible `business:read` mais API overview exige `revenue:read` → erreurs / trou de sécurité UX |
| F-P11-011 | P1 | ~12 sections absentes → reporting incomplet vs mandat |
| F-P11-018 | P2 | Dual tables reports `edge_p11_*` vs `edge_revenue_*` |

## Verdict

**NOT ENTERPRISE READY** pour board reporting.
