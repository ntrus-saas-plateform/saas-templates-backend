# 02 — Audit des frontières d’architecture (P11)

| Champ | Valeur |
|-------|--------|
| Gate B | **PASS** (E5) |
| Verdict périmètre | Soft refs only ; pas de GL dupliqué |

## Non-négociables vérifiés (adversarial)

| Règle | Résultat | Evidence |
|-------|----------|----------|
| Aucune écriture P11 vers `subscriptions` | **PASS E5** | Ports lecture seule (`SubscriptionRepositoryPort`) dans `live-revenue-projection.adapter.ts`, `p5-p6-assurance.adapter.ts`, renewal use-cases |
| Aucune écriture vers `invoices` / `payments` | **PASS E5** | Billing list-only dans assurance adapter ; pas d’INSERT invoice/payment dans `pg-revenue.repository.ts` |
| Aucune création/mutation `tenants` | **PASS E5** | Tables P11 `edge_p11_*` / `edge_revenue_*` uniquement |
| Soft UUID refs seulement | **PASS E5** | Migration 122 header + colonnes `product_ref_id`, `commercial_plan_ref_id`, etc. sans FK dures P5/P6 |
| Pas de ledger GL dupliqué | **PASS E5** | Pas de tables journal/GL dans migrations 122/123 |

### Preuves chemins

- `saas-templates-backend/src/modules/edge/domain/revenue-operations/revenue.types.ts` — commentaire explicite « Never creates invoices, payments, subscriptions, or tenants »
- `saas-templates-backend/src/modules/edge/infrastructure/revenue-operations/live-revenue-projection.adapter.ts` — `listSubscriptions` lecture
- `saas-templates-backend/src/modules/edge/infrastructure/revenue-operations/p5-p6-assurance.adapter.ts` — `listInvoices` lecture
- `saas-templates-backend/migrations/control-plane/122_edge_p11_revenue_operations_foundation.sql` — « Soft UUID refs… no hard FKs »

## Finding P2 — tables dupliquées naming

| ID | Sévérité | Description |
|----|----------|-------------|
| **F-P11-018** | P2 | Double schéma `edge_p11_business_alerts|decisions|reports` (122) vs `edge_revenue_business_*` (123) pour alerts/decisions/reports |

Evidence E3 : commentaires migration 123 « Prefer this when writing new alert rows; 122 edge_p11_business_alerts remains valid » + repository `pg-revenue.repository.ts` écrit dans `edge_revenue_business_*` et audit dans `edge_p11_business_audit_events`.

Risque : divergence opératoire, confusion SoT, requêtes reporting incomplètes.

## Verdict

**Gate B PASS.** Frontières ownership respectées. Finding de duplication naming = dette P2, pas une violation de frontière financière.
