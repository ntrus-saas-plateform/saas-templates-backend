# 30 — DPA / Data Processing Terms (beachhead)

**Statut :** PUBLISHED TEMPLATE — wet-ink Legal counsel requis avant trafic payant CI/WAEMU.  
**Juridiction cible beachhead :** Côte d’Ivoire (+ WAEMU XOF).

## Rôles

| Partie | Rôle |
|--------|------|
| Client (controller) | Responsable des données métier clients finaux |
| Okapi Edge (processor) | Traitement plateforme SaaS (identité, billing meta, CS) |
| Business Backend (processor sub) | Exécution métier sous entitlements Edge |

## Engagements processor (beachhead)

1. Traiter uniquement sur instruction documentée (subscription + entitlements).
2. Pas de revente de données ; pas d’entraînement modèle sans opt-in écrit.
3. Sous-traitants PSP (paiements) — orchestration only ; pas de stockage PAN/CVV Edge.
4. Mesures : isolation tenant/org, M2M fail-closed, audit, secrets hors git.
5. Notification incident : best effort ≤ 72h après confirmation interne.
6. Assistance accès / rectification / effacement — procédure support trust.

## Transferts

Hébergement selon contrat déploiement (SAAS_MULTI_TENANT / DEDICATED / ON_PREM).  
Transferts hors juridiction : avenants explicites — jamais silencieux.

## Durée

Alignée sur subscription ACTIVE + rétention légale facturation (cash-truth / invoices).

## Signature

| Rôle | Nom | Date | Signature |
|------|-----|------|-----------|
| Legal Okapi | | | |
| Client / Partner | | | |
