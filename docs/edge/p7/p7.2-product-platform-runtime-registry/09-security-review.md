# P7.2 — Revue sécurité (post audit remediation)

**Périmètre :** registre technique P7.2 (pas de provisioning runtime).  
**Date :** 2026-11-10  
**Conclusion :** contrôles remédiés **présents et prouvés** (TX atomique, fail-closed compat, DTO runtime, profils non auto-certifiés). Smoke HTTP live hors environnement local.

## Authentification & autorisation

| Contrôle | Statut | Note |
|----------|--------|------|
| Route Edge authentifiée | OK | `@EdgeRoute` + `EdgeAuthGuard` |
| Permission granulaire | OK | `@RequireEdgePermissions` par endpoint — prouvé `registry.controller.auth.spec.ts` |
| Workspace optionnel | OK | `EdgeOptionalWorkspaceGuard` (registre plateforme) |
| FE gating | OK | Onglets / actions masqués selon permissions (tests UI) |
| Séparation certify vs manage | OK | certify produit/contrat ≠ manage opérateur |

## Validation runtime (API hardening)

| Contrôle | Statut | Note |
|----------|--------|------|
| ValidationPipe global | OK | `whitelist` + `forbidNonWhitelisted` + `transform` (`main.ts`) |
| DTO class-validator | OK | UUID, enums, MaxLength, arrays, JSON, pagination bornée, `expectedVersion`, reason, correlationId |
| PATCH dédiés | OK | plus de `Record<string, unknown>` / cast TS comme validation ; champs immuables/sensibles exclus |
| Preuve | OK | `registry.dto.spec.ts` |

## Intégrité transactionnelle

| Contrôle | Implémentation |
|----------|----------------|
| Atomicité mutation+history+audit+outbox | Une TX `ControlPlaneOutboxTransactionService.runWithOutbox` ; client partagé repo/audit/outbox |
| Échec audit / outbox / history | Rollback complet — `edge-registry-transactional.spec.ts` (5/5) |
| Optimistic locking | `expectedVersion` — conflit prouvé (rollback) |
| Pas de 2e système Outbox | Réutilisation CP outbox store + TX manager existants |

## Compatibility fail-closed

| Règle | Statut |
|-------|--------|
| Liste vide ≠ autorisation | OK → `REQUIRES_REVIEW` |
| Mismatch explicite | OK → `INCOMPATIBLE` |
| Info manquante | OK → jamais `COMPATIBLE` |
| PRODUCTION + profil UNCERTIFIED | OK → blocage / review selon moteur |
| Preuves | 58 tests négatifs engine |

## Certification profils

| Contrôle | Statut |
|----------|--------|
| Seed 096 CERTIFIED corrigé | Migration **097** (n’altère pas 096) |
| Seed = AVAILABLE_DOCUMENTED | `UNCERTIFIED` + ACTIVE pour 3 profils canoniques |
| Auto-CERTIFIED sur ACTIVE | **Supprimé** dans `TransitionDeploymentProfileUseCase` |

## Données sensibles

| Risque | Mitigation |
|--------|------------|
| Secrets plateforme | `secure_config_ref` opaque ; UI redaction testée |
| Fuite credentials API | Pas de password/token plaintext dans modèle/DTO PATCH |

## Verdict review

**Acceptable pour merge code remédiation P7.2** sous réserve :
- apply migrate **097** en environnement cible
- smoke HTTP Bearer live en staging (non exécuté localement — API down)
- acceptance G1 humaine (`10`)
