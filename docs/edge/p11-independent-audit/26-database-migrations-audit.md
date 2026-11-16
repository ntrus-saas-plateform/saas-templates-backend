# 26 — Audit migrations base de données (P11)

| Champ | Valeur |
|-------|--------|
| Gate I | **FAIL** |
| Fichiers | `migrations/control-plane/122_edge_p11_revenue_operations_foundation.sql` |
|  | `migrations/control-plane/123_edge_p11_alerts_unit_econ_renewal.sql` |

## Contenu 122 (E3)

- Seed permissions + role_permissions
- ~30+ tables `edge_p11_*` (units, streams, metrics, forecasts, leakage, commissions, partners, cohorts, retention, business alerts/reports/decisions/actions/audit, idempotency…)
- Soft refs ; checks data_quality ; pas de FK dures P5/P6

## Contenu 123 (E3)

- `edge_revenue_business_alert_policies`
- `edge_revenue_business_alerts`
- `edge_revenue_unit_economics_snapshots`
- (decisions/reports alias tables per repository usage)
- Commentaire explicite dual naming vs 122

## Preuves **absentes** cet audit

| Preuve | Statut |
|--------|--------|
| Apply migration sur DB vide | **Non exécuté** |
| Testcontainers | **Non exécuté** |
| Rollback / expand-contract evidence | **Absent** |
| Drift prod | **Non évalué** |

| ID | Sévérité | Finding |
|----|----------|---------|
| **F-P11-014** | P1 | Pas d’evidence apply / Testcontainers |
| **F-P11-018** | P2 | Dual schema naming |
| F-P11-036 | P3 | Pas de checklist migrate runbook sign-off |

## Verdict

SQL **existe et est lisible**. Gate I **FAIL** faute de preuve d’application.
