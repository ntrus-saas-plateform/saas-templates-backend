# 34 — G11 Product Readiness Matrix

Offres beachhead : **Syntix Pharma** + **Okapi Restaurant**.  
Roadmap : **Okapi Retail** + **Okapi Hospitality** (INTERNAL_ONLY — G11 PARTIAL).

## Beachhead

| Critère | Syntix | Restaurant | Preuve |
|---------|--------|------------|--------|
| Implémentée + tests | PASS | PASS | seeds 126/132 + vitest commercial/CS/billing |
| Sécurité vérifiée | PASS | PASS | lab_bb ban, M2M, ModuleGuard, RBAC matrix 23 |
| Perf acceptable | PASS beachhead | PASS beachhead | load smoke doc 33 (seuils) |
| Documentation | PASS | PASS | playbooks 11–14 + rgom package |
| Onboarding prêt | PASS | PASS | E9 playbooks + CS APIs |
| Support formé | PASS beachhead | PASS beachhead | trust/support + runbooks 19 |
| Pricing défini | PASS DRAFT | PASS DRAFT | price books NEEDS_RESEARCH (pas inventé) |
| Démo stable | PASS | PASS | live-complete + wizard golden |
| Contrat / conditions | PASS template | PASS template | DPA 30 + negotiation P10 — wet-ink [43](./43-legal-publish-gate.md) |
| Capacité déploiement | PASS | PASS | adapters prod + frozen nests BB |
| Analytics instrumentés | PASS honest | PASS honest | P11 UNAVAILABLE≠0 + CS health |

**G11 beachhead technique :** PASS.  
**Publish marketing / PUBLISHED P10 :** bloqué tant que Legal wet-ink + price MEASURED ([43](./43-legal-publish-gate.md)).

## Roadmap Product Tenants

| Critère | Retail | Hospitality | Preuve |
|---------|--------|-------------|--------|
| Catalogue + plans Lite→Ent | PARTIAL | PARTIAL | mig 138 + seeds TS ; status DRAFT |
| Entitlements non vides | PARTIAL | PARTIAL | `commercial-plan-entitlements` stubs |
| commercial_availability | INTERNAL_ONLY | INTERNAL_ONLY | mig 133 — **pas AVAILABLE** |
| Provision e2e `bb_control` | **PASS lab** | **PASS lab** | [44](./44-lab-e2e-retail-hospitality-checklist.md) |
| Marketing / P10 PUBLISHED | FAIL | FAIL | presentations DRAFT/REVIEW beachhead only |
| Price MEASURED | FAIL | FAIL | PB_*_ROADMAP NEEDS_RESEARCH |
| **G11 global** | **PARTIAL** | **PARTIAL** | lab e2e OK ; AVAILABLE toujours bloqué |

Montants prix MEASURED : uniquement après research fill (pas inventé).
