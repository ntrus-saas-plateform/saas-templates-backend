# P7.2 — Revue sécurité

**Périmètre :** registre technique P7.2 (pas de provisioning runtime).  
**Conclusion code review :** contrôles attendus **présents** ; validation runtime migrate / smoke prod hors de ce document.

## Authentification & autorisation

| Contrôle | Statut | Note |
|----------|--------|------|
| Route Edge authentifiée | OK | `@EdgeRoute` + `EdgeAuthGuard` |
| Permission granulaire | OK | `@RequireEdgePermissions` par endpoint |
| Workspace optionnel | OK | `EdgeOptionalWorkspaceGuard` (registre plateforme) |
| FE gating | OK | Onglets / actions masqués selon permissions |
| Séparation certify vs manage | OK | certify produit/contrat ≠ manage opérateur |

## Données sensibles

| Risque | Mitigation |
|--------|------------|
| Secrets plateforme en clair | Colonne `secure_config_ref` = handle opaque ; commentaire SQL + type TS ; UI `redactSecureConfigRef` |
| Fuite credentials via API | Pas de champ password/token plaintext dans le modèle |
| Catalogue commercial dupliqué | FK `edge_products` uniquement |

## Intégrité & anti-abus métier

| Contrôle | Implémentation |
|----------|----------------|
| Optimistic locking | `expectedVersion` / colonne `version` produits, plateformes, envs |
| Immutabilité post-publish | Domain asserts + CHECK SQL contrats |
| Transitions sensibles | Reason obligatoire (suspend/deprecate/retire) |
| Compatibilité | Aucun match implicite ; allowlist vide ≠ authorize |
| Audit obligatoire | Échec audit → erreur domaine (pas de mutation « silencieuse ») |
| Outbox | Events `p7.registry.*.v1` pour traçabilité async |

## Surface d’attaque / hors scope

| Item | Statut |
|------|--------|
| Création tenant / DB | Non exposé (P7.3+) |
| Keycloak admin | Non exposé |
| Runtime deploy / shell | Non exposé |
| Endpoints publics anonymes | Non — Bearer Edge requis |

## Recommandations résiduelles

1. Confirmer grants OPERATOR en staging après apply 096.
2. Vérifier qu’aucun logger n’écrit `secureConfigRef` en clair (revue ops).
3. Rate-limit / audit review sur `POST .../compatibility/evaluate` en charge élevée (optionnel).
4. Ne pas considérer la sécurité « fermée » tant que migrate 096 n’est pas appliquée (permissions absentes en DB = comportement 403/fail-closed à valider).

## Verdict review

**Acceptable pour merge code P7.2** sous réserve : apply migrate + preuves tests (`08`) + acceptance G1 (`10`) en environnement cible.
