# 03 — Audit fondation domaine P11

| Champ | Valeur |
|-------|--------|
| Couches | domain / application / infrastructure / presentation |
| Verdict | Fondation **présente** ; exhaustivité métier **incomplète** |

## Structure observée (E3)

```
saas-templates-backend/src/modules/edge/
  domain/revenue-operations/     # calculatrices pures + registry + ports
  application/revenue-operations/ # revenue.use-cases.ts
  infrastructure/revenue-operations/ # pg + live/stub projection + assurance
  presentation/controllers/revenue-operations.controller.ts
  presentation/dto/revenue.dto.ts
```

### Agrégats / concepts couverts

| Concept | Statut | Evidence |
|---------|--------|----------|
| Metric definitions + versions + snapshots | PRESENT | tables `edge_p11_metric_*` (122) |
| Business units / streams | PRESENT | `edge_p11_business_units`, `edge_p11_revenue_streams` |
| Forecasts / scenarios | PRESENT (API) | use-cases + tables 122 |
| Leakage / reconciliations | PRESENT (API) | controller + tables |
| Commission plans / calc / approve | PRESENT (API) | controller endpoints |
| Partners | SCHEMA only (partiel) | tables `edge_p11_partner_*` ; UI absente |
| DataQuality MEASURED/ESTIMATED/UNAVAILABLE | PRESENT E2 | `revenue.types.ts` + use-cases validation |

## Politique domaine

Fichier `revenue-policy.ts` + validations dans `revenue.use-cases.ts` :

- Snapshots `UNAVAILABLE` → `value` doit être `null` (pas de montant fabriqué).
- Profitabilité produit : revenue doit être `MEASURED` ; coûts peuvent être `UNAVAILABLE` → marge nulle.

## Gaps fondation (findings)

| ID | Sévérité | Gap |
|----|----------|-----|
| F-P11-001 | P0 | Métriques COLLECTED/INVOICED définies sans moteur exécutable |
| F-P11-019 | P2 | Plusieurs tables 122 sans surface FE / scénarios E2E |
| F-P11-034 | P3 | Stub projection vs live — bascule runtime peu documentée opérationalement |

## Verdict

Fondation DDD lisible et bornée (**PASS partiel**). Non certifiable comme « domaine revenue enterprise complete » sans moteurs cash/facture et pack tests ([F-P11-001](./34-findings-and-risk-register.md), [F-P11-002](./34-findings-and-risk-register.md)).
