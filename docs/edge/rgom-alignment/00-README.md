# Okapi Edge × Business Backend — Programme d’alignement RGOM

**Statut :** **ENTERPRISE PRODUCTION READY — TECHNICAL CERTIFICATION PASS** ([36](./36-enterprise-production-ready-certification.md))  
**Date :** 2026-11-17  
**Périmètre :** Alignement complet de la Product Platform (Edge) et du Business Backend (BB) avec la *Doctrine globale de commercialisation* et le *Revenue & Growth Operating Model (RGOM)*.  
**Objectif :** Implémentation **enterprise-grade** et **production-ready** du moteur de revenus, d’acquisition, d’activation et de croissance.  
**Residual go-live marketing :** wet-ink Legal (DPA) + Security — voir [02](./02-production-readiness-gates.md).

---

## Documents de ce package

| Fichier | Rôle |
|--------|------|
| [00-README.md](./00-README.md) | Index (ce fichier) |
| [01-program-overview.md](./01-program-overview.md) | Vision, principes, cardinalité, Definition of Done |
| [02-production-readiness-gates.md](./02-production-readiness-gates.md) | Gates Go/No-Go production |
| [03-cross-dependencies.md](./03-cross-dependencies.md) | Dépendances Edge ↔ BB et chemin critique |
| [04-plan-edge-implementation.md](./04-plan-edge-implementation.md) | Plan Edge E0–E12 + checklists |
| [05-backlog-epics.md](./05-backlog-epics.md) | Epics / tickets structurés |
| [06-source-of-truth-matrix.md](./06-source-of-truth-matrix.md) | Autorités de données (SoT) |
| [07-pr-checklist.md](./07-pr-checklist.md) | Checklist merge PR Edge |
| [09-billing-lifecycle.md](./09-billing-lifecycle.md) | Lifecycle invoice / payment / credit |
| [10-billing-e2e-evidence-pack.md](./10-billing-e2e-evidence-pack.md) | Template evidence pack billing e2e |
| [11-onboarding-playbook-retail-pharmacy.md](./11-onboarding-playbook-retail-pharmacy.md) | Playbook onboarding Syntix Pharmacy |
| [12-onboarding-playbook-wholesale.md](./12-onboarding-playbook-wholesale.md) | Playbook onboarding Wholesale |
| [13-onboarding-playbook-restaurant.md](./13-onboarding-playbook-restaurant.md) | Playbook onboarding Restaurant |
| [14-renewal-playbook.md](./14-renewal-playbook.md) | Renewal pré-échéance + health/churn |
| [15-revenue-console-honesty.md](./15-revenue-console-honesty.md) | Scopes console revenue (pas faux 30/30) |
| [16-e10-remediation-beachhead.md](./16-e10-remediation-beachhead.md) | Statut remediation E10 / P11 |
| [17-partner-program-rules.md](./17-partner-program-rules.md) | Règles partenaire / commission ≠ payout |
| [18-enterprise-abm-templates.md](./18-enterprise-abm-templates.md) | Templates ABM / assessment Enterprise |
| [19-runbooks-critical-paths.md](./19-runbooks-critical-paths.md) | Runbooks provision / dunning / drift / CS |
| [20-p11-signed-exceptions.md](./20-p11-signed-exceptions.md) | Exceptions signées P11 (E10 close) |
| [21-rollback-plan.md](./21-rollback-plan.md) | Plan de rollback |
| [22-observability-critical-path.md](./22-observability-critical-path.md) | Observabilité chemin critique |
| [23-rbac-console-matrix.md](./23-rbac-console-matrix.md) | Matrice RBAC console beachhead |
| [24-e12-lab-exceptions.md](./24-e12-lab-exceptions.md) | Exceptions lab/CI E12 |
| [25-gates-review-beachhead.md](./25-gates-review-beachhead.md) | Review G0–G11 beachhead |
| [26-e4-demand-generation-beachhead.md](./26-e4-demand-generation-beachhead.md) | Demand gen / landings / calendar |
| [27-e5-sales-engine-beachhead.md](./27-e5-sales-engine-beachhead.md) | Sales engine beachhead |
| [28-e6-acquisition-beachhead.md](./28-e6-acquisition-beachhead.md) | Acquisition P10 closure |
| [29-enterprise-deployment-templates.md](./29-enterprise-deployment-templates.md) | Deployment ≠ plan tier |
| [30-dpa-beachhead.md](./30-dpa-beachhead.md) | DPA / Data Processing (template Legal) |
| [31-backup-restore-posture.md](./31-backup-restore-posture.md) | Posture backup / restore |
| [32-migrations-staging-prod-checklist.md](./32-migrations-staging-prod-checklist.md) | Checklist migrations staging/prod |
| [33-load-smoke-provision-ready.md](./33-load-smoke-provision-ready.md) | Load smoke provision → ready |
| [34-g11-product-readiness-matrix.md](./34-g11-product-readiness-matrix.md) | Matrice G11 Syntix + Restaurant |
| [35-remote-push-reproducibility.md](./35-remote-push-reproducibility.md) | Push remote / reproductibilité |
| [36-enterprise-production-ready-certification.md](./36-enterprise-production-ready-certification.md) | Certification EPR technique |
| [37-capability-assurance-edge-bb.md](./37-capability-assurance-edge-bb.md) | Assurance sub/bill/prov + APIs publiques |
| [38-verticals-and-provisioning-scale-audit.md](./38-verticals-and-provisioning-scale-audit.md) | Verticaux BB vs Edge + vérité échelle 50k/s |
| [39-master-improvement-alignment-plan.md](./39-master-improvement-alignment-plan.md) | Plan maître amélioration / alignement (Phases A–H) |
| [40-provisioning-scale-architecture.md](./40-provisioning-scale-architecture.md) | Architecture scale H0–H3 (warm pool / jobs / SLO) |
| [41-onboarding-playbook-retail.md](./41-onboarding-playbook-retail.md) | Playbook Retail (G11 PARTIAL) |
| [42-onboarding-playbook-hospitality.md](./42-onboarding-playbook-hospitality.md) | Playbook Hospitality (G11 PARTIAL) |
| [43-legal-publish-gate.md](./43-legal-publish-gate.md) | Gate Legal / P10 PUBLISH |
| [44-lab-e2e-retail-hospitality-checklist.md](./44-lab-e2e-retail-hospitality-checklist.md) | Checklist e2e lab Retail/Hosp |
| [45-provisioning-slo-alerts.md](./45-provisioning-slo-alerts.md) | Alertes Prometheus H1 |
| [46-legal-publish-evidence-pack.md](./46-legal-publish-evidence-pack.md) | Pack evidence Legal/Publish |
| [47-grafana-import-runbook.md](./47-grafana-import-runbook.md) | Import Grafana H1 |
| [grafana-provisioning-h1-dashboard.json](./grafana-provisioning-h1-dashboard.json) | Dashboard Grafana H1 |

Scripts : `pnpm lab:e2e:retail|hospitality` · BB `pnpm warm-pool:refill`  

Migrations roadmap : **133–139** Edge · BB warm pool **133**. |
| [ADR-021](../adr/ADR-021.md) | Product Tenant = 1 produit vertical |
| BB : [plan BB](../../../../edge-business-backend/docs/rgom-alignment/00-README.md) | Plan BB B0–B9 + ADR-055 org |

### Anti-claims (inchangés)

- ❌ Tous les verticaux BB déjà vendables via Edge  
- ❌ 50 000 provisions/s aujourd’hui (voir [38](./38-verticals-and-provisioning-scale-audit.md) + [40](./40-provisioning-scale-architecture.md))  
- ✅ Beachhead Syntix + Restaurant : EPR technique PASS ([36](./36-enterprise-production-ready-certification.md))  
- ✅ Roadmap Product Tenants PLANNED (Retail, Hospitality, …) sans AVAILABLE inventé (mig **133**, doc **39**) |

---

## Sources stratégiques

1. Okapi Edge — Stratégie globale de commercialisation, marketing, vente et croissance (v1.0)
2. Okapi Edge — Revenue & Growth Operating Model (RGOM)
3. Code & docs existants : P1–P11 Edge, `edge-business-backend` control/v1

---

## Comment utiliser ce package

1. Lire [01-program-overview.md](./01-program-overview.md) et accepter les ADR.
2. Suivre les checklists de [04-plan-edge-implementation.md](./04-plan-edge-implementation.md).
3. Suivre en parallèle le plan BB (`edge-business-backend/docs/rgom-alignment/`).
4. Ne pas déclarer production-ready tant que [02-production-readiness-gates.md](./02-production-readiness-gates.md) n’est pas entièrement coché.
5. Cocher les cases au fur et à mesure ; ne jamais cocher sans preuve (test, mig, doc, audit).

---

## Beachhead recommandé

1. **Syntix Pharma** — Retail Pharmacy + Wholesale  
2. **Okapi Restaurant** — Independent + Multi-site  
3. Autres verticales : taxonomy + catalogue seulement jusqu’à readiness gate

---

## Règle d’or

> Le chassis technique existe déjà (P1–P11). Ce programme **remplit, ferme et certifie** la machine commerciale — il ne réécrit pas les frontières Edge / CRM / Billing / BB.
