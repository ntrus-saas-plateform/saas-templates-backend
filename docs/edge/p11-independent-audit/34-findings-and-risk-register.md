# 34 — Registre des findings & risques (P11)

| Champ | Valeur |
|-------|--------|
| Totaux | **P0: 3 · P1: 14 · P2: 16 · P3: 8** (= **41**) |
| Verdict lié | CORRECTIONS REQUIRED — NOT ACCEPTED — NOT ENTERPRISE READY |

Légende evidence : **E0** claim · **E1** doc · **E2** unit test · **E3** code review · **E4** runtime intégré · **E5** adversarial vérifié.

---

## P0 — Bloquants (3)

| ID | Titre | Evidence | Refs |
|----|-------|----------|------|
| **F-P11-001** | Pas de moteur exécutable COLLECTED/INVOICED malgré métriques canoniques ; risque mésusage exécutif si snapshots injectés sans lignée P6 | E3 registry + `isCollectedEligible` only ; API snapshots | [04](./04-metric-registry-audit.md), [31](./31-financial-calculation-validation.md) |
| **F-P11-002** | Pack tests financiers 1–25 / E2E 1–45 largement non prouvé — exactitude non certifiable | E2 partiel 93/5 ; E2E NOT executed | [28](./28-backend-test-results.md), [30](./30-e2e-test-results.md) |
| **F-P11-003** | SHA remote ne contiennent pas P11 — non reproductible depuis GitHub seul (push 403) | E5 git | [01](./01-git-reproducibility-report.md) |

---

## P1 — Majeurs (14)

| ID | Titre | Evidence | Refs |
|----|-------|----------|------|
| **F-P11-004** | Live projection marque `MEASURED` avec `paymentStatus: UNKNOWN` | E3 `live-revenue-projection.adapter.ts` | [05](./05-revenue-intelligence-audit.md) |
| **F-P11-005** | Live projection mouvements seulement STARTING/ENDING | E3 | [07](./07-revenue-movements-audit.md) |
| **F-P11-006** | Expansion/contraction exigent deltas pré-classifiés ; 100→150 non testé comme dérivation | E2/E3 | [06](./06-mrr-arr-calculation-audit.md) |
| **F-P11-007** | Aucun moteur FX / consolidation multi-devises | E3 | [17](./17-currency-geography-audit.md) |
| **F-P11-008** | Pas de discounts, refunds, prorata, multi-year dans calculateurs | E3 | [06](./06-mrr-arr-calculation-audit.md) |
| **F-P11-009** | Pas de calculateur LOGO_CHURN (registry only) | E3 | [04](./04-metric-registry-audit.md) |
| **F-P11-010** | Mismatch permissions : Overview visible `business:read` mais API `revenue:read` | E3 FE/BE | [22](./22-edge-admin-console-audit.md), [25](./25-security-authorization-audit.md) |
| **F-P11-011** | Console ~12 sections ABSENT vs mandat 30 ; 10 tabs only | E3 | [22](./22-edge-admin-console-audit.md) |
| **F-P11-012** | Exhaustivité financière Gate C non atteinte (hors COLLECTED : receivables, churn rates exécutables) | E3 | [31](./31-financial-calculation-validation.md) |
| **F-P11-013** | Rôles incomplets vs mandat entreprise (matrice endpoints existe E3) | E3 migration 122 | [25](./25-security-authorization-audit.md) |
| **F-P11-014** | Pas d’evidence apply migrations / Testcontainers | — | [26](./26-database-migrations-audit.md) |
| **F-P11-015** | Pas de load tests / preuves perf | — | [27](./27-performance-reliability-audit.md) |
| **F-P11-016** | Playwright E2E live non exécuté cet audit | — | [30](./30-e2e-test-results.md) |
| **F-P11-017** | Ahead 11/21 + push denied — divergence collab / revue distante impossible | E5 | [01](./01-git-reproducibility-report.md) |

---

## P2 — Modérés (16)

| ID | Titre | Evidence |
|----|-------|----------|
| **F-P11-018** | Duplicate tables `edge_p11_business_*` vs `edge_revenue_*` (alerts/decisions/reports) | E3 mig 123 + repo |
| **F-P11-019** | Nombreuses tables 122 sans surface FE / E2E | E3 |
| **F-P11-020** | Projection live limitée à 500 subscriptions | E3 |
| **F-P11-021** | Pas d’attribution coûts automatique profitabilité | E3 |
| **F-P11-022** | Suite modèles forecast incomplete | E3 |
| **F-P11-023** | Outbox/idempotency runtime E4 non validé | E3 structure only |
| **F-P11-024** | Expansion playbooks / NBA absents | E3 |
| **F-P11-025** | Pas d’adapter recognized revenue accounting SoT | E3 |
| **F-P11-026** | Partner channel schema-only / UI absente | E3 |
| **F-P11-027** | Commission inventory / partner statements absents | E3 |
| **F-P11-028** | Unit economics sans ingestion spend auto | E3 |
| **F-P11-029** | Dimensions géographie / market packs absents | E3 |
| **F-P11-030** | Registre risques revenu riche non exposé | E3 |
| **F-P11-031** | Planning variance UI absente | E3 |
| **F-P11-032** | Canaux notification alerts non prouvés | E3 |
| **F-P11-033** | Data catalog / retention policy opérable absente | E3 |

---

## P3 — Mineurs (8)

| ID | Titre |
|----|-------|
| **F-P11-034** | Bascule stub vs live projection peu documentée ops |
| **F-P11-035** | Smoke CSRF non exécuté live cet audit |
| **F-P11-036** | Checklist migrate runbook sign-off manquante |
| **F-P11-037** | Pas d’audit a11y automatisé |
| **F-P11-038** | Empty states UNAVAILABLE non standardisés DS-wide |
| **F-P11-039** | Playbooks on-call leakage/alerts absents E4 |
| **F-P11-040** | Handbook ops unifié docs implémentation↔audit manquant |
| **F-P11-041** | Dirty tree P10 doc hors scope — bruit pour opérateurs git |

---

## Cartographie risques → gates

| Gate | Findings clés |
|------|----------------|
| A | F-P11-003, F-P11-017 |
| B | (PASS) — F-P11-018 dette naming |
| C | F-P11-001, F-P11-012, F-P11-007/008/009 |
| D | F-P11-002, F-P11-006, F-P11-016 |
| E | F-P11-011, F-P11-010 |
| F | F-P11-001, F-P11-004, F-P11-018, F-P11-033 |
| G | F-P11-015, F-P11-020 |
| H | F-P11-013, F-P11-010 |
| I | F-P11-014, F-P11-018 |
| J | F-P11-036…040, F-P11-003 |

## Décision

Tout P0 ouvert ⇒ **CORRECTIONS REQUIRED**. Voir [35](./35-remediation-roadmap.md) et [36](./36-final-certification-decision.md).
