# 18 — Audit risques revenu (P11)

| Champ | Valeur |
|-------|--------|
| Schema | `edge_p11_revenue_risks` |
| Renewal risk | Heuristique présente |
| Verdict | **PARTIEL** |

## Présent

- Scoring renewal ([12](./12-renewal-expansion-intelligence-audit.md))
- Leakage cases / anomalies tables
- Alert policies thresholds (123)

## Absent / faible

| ID | Sévérité | Gap |
|----|----------|-----|
| F-P11-030 | P2 | Pas de registre risques revenu riche (concentration, credit, geo) exposé UI |
| F-P11-004 | P1 | Risque qualité données : MEASURED + payment UNKNOWN |
| F-P11-001 | P0 | Risque mésusage exécutif COLLECTED/INVOICED |

## Verdict

Risk ops = alerts + renewal heuristic. Enterprise revenue risk management **FAIL**.
