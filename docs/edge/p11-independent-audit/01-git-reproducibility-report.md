# 01 — Rapport de reproductibilité Git (P11)

| Champ | Valeur |
|-------|--------|
| Niveau de preuve cible | E5 (adversarial) |
| Gate A | **FAIL** |
| Finding lié | **F-P11-003** (P0) |

## Backend — `saas-templates-backend`

| Item | Valeur vérifiée |
|------|-----------------|
| Branche | `feature/console` |
| HEAD local | `92d4ff7810132646cc4048cd1ad7c0c8f4a91b2b` |
| `origin/feature/console` | `7cb2c5d7581ceffbf9a574e0c6ac89c0a0810c25` |
| Ahead | **11** commits |
| Push | **DENIED** `403` (`kabikaAsyst` → remote) |

### Commits P11 (chaîne locale)

| SHA court | Type | Note |
|-----------|------|------|
| `7e29a03` | feat | Implémentation P11 revenue-operations |
| `864c032` | docs | Documentation package implémentation |
| `92d4ff7` | docs | Docs (HEAD) |

### Dirty tree (hors scope P11)

- `docs/.../19-p10-acceptance-report.md` — dirty, **hors scope P11** (ne pas confondre avec livrables P11).

## Frontend — `saas-template-frontend`

| Item | Valeur vérifiée |
|------|-----------------|
| HEAD local | `e1225cce69052b8e7b298afaca8e24731f27108b` |
| `origin/feature/console` | `d7dcb2eb4181070d643ca3300ca5250ff6c097ed` |
| Ahead | **21** commits |
| Commit P11 | `e1225cc` |
| Push | **DENIED** `403` |

## Verdict reproductibilité

| Critère | Résultat | Evidence |
|---------|----------|----------|
| Clone remote seul suffit à reconstruire P11 | **FAIL** | Remote SHAs **ne contiennent pas** les commits P11 |
| Audit machine locale peut inspecter le code | PASS (local only) | HEAD locaux ci-dessus |
| Claim « poussé / partagé » | **REFUSED** | 403 explicite |

## Implications certification

1. Un tiers clonant `origin/feature/console` **ne verra pas** P11 → Gate A FAIL ([F-P11-003](./34-findings-and-risk-register.md)).
2. Les preuves de cet audit sont ancrées sur les HEAD **locaux** listés — pas sur GitHub.
3. Jusqu’à push réussi + SHA remote = HEAD local, toute certification « enterprise reproducible » est **invalide**.

## Cross-links

- Synthèse : [00-executive-audit-summary.md](./00-executive-audit-summary.md)
- Décision : [36-final-certification-decision.md](./36-final-certification-decision.md)
