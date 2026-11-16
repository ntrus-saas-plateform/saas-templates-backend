# 04 — P5 / P6 / P7 Integration Contracts

## Principes

| Domaine | P8 peut | P8 ne peut pas |
|---|---|---|
| P5 | Lire subscription, entitlements, périodes ; demander actions via API/use cases P5 | Modifier statut contractuel canonique, inventer entitlements |
| P6 | Afficher références factures / état synthétique / blocages connus | Créer factures, paiements, ledgers |
| P7 | Lire projections techniques ; déclencher workflows via ports existants | Réimplémenter provisioning, placement, infra, Keycloak, config deploy |

## Contrats P5 à consommer

- `SubscriptionRepositoryPort` — lecture subscription + plan + status
- `P5AuthorizationStatusPort` — fail-closed authz provisioning
- `edge/subscriptions/:id` et handoff provisioning
- Events / inbox révocation : `edge_p7_authorization_revocation_inbox`

## Contrats P6 à consommer

- Billing account lié `commercial_account_id` / `subscription_id`
- Lectures via `BillingRepositoryPort` / APIs billing existantes
- Affichage 360° avec `source` + `syncedAt` ; absence → `UNAVAILABLE`

## Contrats P7 à consommer / déclencher

| Capacité | Port / API | Usage P8 |
|---|---|---|
| Authz / request | Provisioning ports | Origine productTenantId |
| Infra resources | InfrastructureRepositoryPort | Resource registry projection |
| Keycloak | KeycloakRepositoryPort | Topology refs |
| Config / experience | Configuration / Experience ports | Overview + drift signals |
| Activation | ActivationRepositoryPort | Technical readiness |
| Lifecycle | LifecycleRepositoryPort + workflows | Suspend/resume/deprovision exécution |
| Workflow engine | WorkflowRepositoryPort | Durable ops |

## Règles d’intégration

1. Toute mutation technique → workflow P7.4 + revalidation P7.1.
2. Toute mutation commerciale → use case P5.
3. P8 lifecycle **requests** stockent l’intention administrative ; l’exécution renvoie vers P7.11 (ou P5 si commercial).
4. Timeouts réseau ≠ échec distant ; réconciliation obligatoire.
5. Secrets jamais projetés dans les DTO P8.

## Événements

- Consommer événements P5/P7 canoniques pour sync registry (inbox idempotent).
- Émettre événements P8 (`tenant.registered`, `tenant.lifecycle.requested`, …) via control-plane outbox.
