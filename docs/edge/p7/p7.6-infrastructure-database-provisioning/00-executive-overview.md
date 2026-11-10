# P7.6 — Executive Overview

**Phase:** Infrastructure & Database Provisioning  
**Branche:** `feature/console`  
**Hors scope:** Keycloak (P7.7), entitlements métier, activation tenant.

## Providers réellement supportés

| Provider | Statut |
|----------|--------|
| `local-managed-v1` | **OPÉRATIONNEL** (réseau privé, storage chiffré, compute optionnel, DB via adapters) |
| Cloud public / K8s / on-prem | **NON DÉCLARÉS** (pas d’adaptateur ni tests) |

## Moteurs de bases réellement supportés

| Moteur | Adapter | Preuve |
|--------|---------|--------|
| PostgreSQL | `PostgresqlDatabaseAdapter` | IT Testcontainers (CREATE DATABASE + rôle least-privilege + isolation) |
| MongoDB | `MongodbDatabaseAdapter` | Driver officiel (nécessite `EDGE_P76_MONGO_ADMIN_URL`) |
| SurrealDB | `SurrealdbDatabaseAdapter` | HTTP `/sql` (nécessite `EDGE_P76_SURREAL_ADMIN_URL`) |

## Garanties

- ResourcePlan versionné + fingerprint
- Vérifications P7.1 / P7.2 / P7.3 via contexte de validation fail-closed
- Handlers P7.4 : `infrastructure.*` / `database.*` / `resource.*`
- Secrets externalisés (`EncryptedSecretsProvider`) — refs opaques seulement en PostgreSQL CP
- Compensation suspendue si données possibles / état ambigu
- Pas de P7.7
