# 12 — Audit renewal & expansion intelligence (P11)

| Champ | Valeur |
|-------|--------|
| Domain | `renewal-intelligence.ts` + specs |
| API | `GET edge/revenue/renewals/intelligence` |
| Verdict | Heuristique **présente** ; expansion intelligence **faible** |

## Scoring (E2/E3)

`scoreRenewalRisk` — score 0–100 heuristique :

- proximité renewalAt
- MRR at risk
- contraction history
- delinquency

Specs : `renewal-intelligence.spec.ts` (imminent + delinquency + contraction).

Use-case : lecture `SubscriptionRepositoryPort` ; si non wired → `availability: UNAVAILABLE` + note explicite (pas d’invention).

## Expansion

Pas de moteur dédié « expansion opportunity » au-delà des buckets MRR_EXPANSION pré-classifiés et du scoring contraction historique.

| ID | Sévérité | Gap |
|----|----------|-----|
| F-P11-024 | P2 | Expansion playbooks / next-best-action absents |
| F-P11-005 | P1 | Sans mouvements live, expansion signal pauvre |
| F-P11-016 | P1 | E2E renewals non exécuté cet audit |

## Console

Onglet Renewals PRESENT (`platform:revenue:read`).

## Verdict

Renewal risk MVP **PASS partiel E2**. Expansion intelligence enterprise **FAIL**.
