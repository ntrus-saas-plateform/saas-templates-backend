# Platform Core - Architecture Analysis

## Executive Summary

**Platform Core** est une plateforme SaaS multi-tenant de type ERP/commerce de niveau enterprise, construite avec **NestJS 12** et TypeScript. Conçue comme un **modular monolith** évolutif vers microservices, elle couvre un périmètre fonctionnel très large incluant commerce, inventory, CRM, warehouse, insurance, pharmacy, POS, loyalty, et bien plus.

**Points clés :**
- **Isolation stricte** : DB-per-tenant avec pools de connexions par tenant
- **Résilience robuste** : Patterns Outbox/Inbox, circuit breaker, retry
- **Sécurité complète** : Guards granulaires, MFA, OPA, rate limiting
- **Tests exhaustifs** : Unitaires → intégration → e2e → load
- **Observabilité mature** : Logs, metrics, tracing
- **Documentation complète** : Architecture, autorisation, audit

---

## Architecture Globale

### Structure modulaire
```
src/
├── core/domain/          # Entités métier pures, ports, erreurs
├── core/application/     # Use cases (couche applicative)
├── shared/               # Infrastructure transverse
│   ├── auth/             # JWT validation, guards
│   ├── tenancy/          # TenantContext (AsyncLocalStorage)
│   ├── database/         # TenantDatabaseManager, pools
│   ├── messaging/        # Outbox, RabbitMQ, Inbox
│   ├── audit/            # Audit trail
│   ├── idempotency/      # HTTP idempotency
│   ├── observability/    # Metrics, logging
│   └── configuration/    # Validated env config
└── modules/              # Bounded contexts métier (30+)
```

### Couches architecturales

1. **Couche Domaine (core/domain)**
   - Entités métier pures (sans dépendances frameworks)
   - Ports d'accès (interfaces)
   - Règles métier (engines, policies)
   - Erreurs domaine

2. **Couche Application (core/application)**
   - Use cases orchestrant les entités domaine
   - Cas d'utilisation transactionnels
   - Validation métier

3. **Couche Infrastructure (shared)**
   - Guards d'authentification/autorisation
   - Gestion du contexte multi-tenant
   - Connexions base de données
   - Publication/abonnement
   - Audit et idempotence
   - Observabilité

4. **Couche Modules (modules)**
   - Contextes bounded business (catalog, inventory, sales, etc.)
   - Contrôleurs presentation
   - Persistence adapters

---

## Multi-tenancy - Architecture de pointe

### Modèle DB-per-tenant
- **Chaque tenant** = base PostgreSQL isolée
- **Control plane** = PostgreSQL central (platform_control)
- **Isolation stricte** : Pas de partage de données entre tenants

### Gestionnaire de base de données par tenant
```typescript
// src/shared/database/tenant-database.manager.ts
export class TenantDatabaseManager implements OnModuleDestroy {
  private readonly pools = new Map<string, PoolEntry>();
  
  async getPool(tenantId: string): Promise<Pool> {
    // Cache pool par tenant avec circuit breaker
  }
  
  evictIdlePools(): void {
    // Évacuation automatique des pools inactifs
  }
}
```

### Contexte multi-tenant
```typescript
// src/shared/tenancy/tenant-context.service.ts
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContextData>();
  
  run<T>(context: TenantContextData, fn: () => T): T {
    // Contexte isolé par requête
  }
  
  get(): TenantContextData {
    // Récupération du contexte courant
  }
}
```

### États du tenant et transitions
```typescript
export enum TenantStatus {
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  READ_ONLY = 'READ_ONLY',
  DEACTIVATING = 'DEACTIVATING',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
  FAILED = 'FAILED',
  LOCKED = 'LOCKED',
}
```

### Résolution du tenant
- **Source unique** : JWT `tenant_id` claim
- **Jamais** depuis headers/parameters
- **Validation** : Tenant doit exister et être accessible
- **Contexte** : Stocké dans AsyncLocalStorage pour toute la requête

---

## Authentification et Autorisation

### Flux d'authentification
1. **JWT Validation** via JWKS Keycloak
2. **Introspection optionnelle** Keycloak
3. **Denylist** des tokens révoqués
4. **MFA enforcement**
5. **PAT support** (Personal API Tokens)
6. **B2C customer JWT** support

### Guards en cascade
```
HTTP Request
  → Request ID / Correlation ID
  → JWT Authentication (AuthGuard)
  → Tenant Resolution (TenantGuard)
  → Organization Resolution (OrganizationGuard)
  → Authorization (PermissionGuard)
  → Rate Limiting
  → Validation
  → Idempotency (mutations)
  → Application Logic
  → Audit (opérations sensibles)
```

### AuthGuard
- Validation JWT avec JWKS
- Introspection Keycloak optionnelle
- Vérification dénialiste
- Résolution organisation active
- Compliance MFA
- Stockage du contexte utilisateur

### TenantGuard
- Validation existence tenant
- Contrôle des états (LOCKED, SUSPENDED, etc.)
- Vérification appartenance organisation
- Métriques de sécurité

### PermissionGuard
- Évaluation des permissions/rôles via décorateurs
- Refus par défaut configurable
- Validation client pour rôle platform-admin
- Métriques de refus de permission

### OPA (optionnel)
- Politique d'autorisation externe
- Fallback pour politiques complexes
- Timeout configurable (100-30000ms)

---

## Patterns de messagerie

### Architecture Outbox/Inbox
```
Domain Event → Outbox Store → Outbox Publisher → RabbitMQ
                                           ↓
                                      Inbox Deduplicator ← Consumer
```

### Outbox Publisher
- **Leader election** via Redis lock
- **Publication par lots** (batchSize=50)
- **Retry + Dead letter** (maxAttempts=5)
- **Contrôle plane** séparé pour événements système

### Inbox Deduplicator
- **Idempotence consommateur** via `inbox_messages`
- **Claim/Release** pour consommation sûre
- **ON CONFLICT DO NOTHING** pour déduplication

### Catalogue d'événements
- **500+ événements versionnés** (`event-catalog.ts`)
- **Types d'événements** : organization.switched, tenant.created, membership.created, etc.
- **Versionning** pour l'évolution métier

---

## Idempotence HTTP

### Header Idempotency-Key
- **Stockage** : `idempotency_keys` (control plane)
- **Hash de requête** : SHA256 du corps + méthode + URL
- **TTL configurable** (`IDEMPOTENCY_TTL_SECONDS`)
- **Replay** : Réponse originale stockée

### Workflow
1. **Première requête** : Stocke le hash, retourne `202 Accepted`
2. **Réponse** : Stocke status + corps
3. **Requête suivante** : Vérifie hash, rejoue si identique

---

## Observabilité

### Logs (Pino)
- **JSON structuré** avec correlation ID
- **Niveaux** : fatal, error, warn, info, debug, trace
- **Middleware** : Request logging + startup banner
- **Filtrage** : Masquage des données sensibles

### Metrics (Prometheus)
- **Métriques HTTP** : requêtes, latence, erreurs
- **Métriques DB** : pool usage, connections
- **Métriques Outbox** : succès, échecs, retries
- **Métriques Identité** : tentatives de connexion, refus de permission
- **Endpoint** : `/metrics`

### Tracing (OpenTelemetry)
- **Auto-instrumentation** : NestJS, HTTP, DB, RabbitMQ
- **Export OTLP** : HTTP vers collector
- **Service naming** : configurable via `SERVICE_NAME`
- **Shutdown propre** : SIGTERM → fermeture gracieuse

### Health Checks
- **Liveness** : `/liveness` (basique)
- **Readiness** : `/readiness` (DB, Redis, RabbitMQ)
- **Health** : `/health` (somme des dépendances)

---

## Sécurité

### Sécurité au niveau transport
- **Helmet** (hors développement)
- **CORS** : origines configurables + URL publique
- **Headers** : Content-Type, Authorization, X-Request-Id, etc.

### Sécurité au niveau application
- **Rate limiting** : `@nestjs/throttler` (TTL configurable)
- **Validation** : DTO stricts (whitelist, forbidNonWhitelisted)
- **CSRF** : Middleware pour états non-idempotents
- **Taille payload** : configurable (`MAX_PAYLOAD_SIZE`)

### Sécurité des données
- **Vault/Env** : Secrets via HashiCorp Vault ou variables d'environnement
- **Chiffrement** : SSL/TLS pour connexions DB
- **Audit** : Toutes les opérations sensibles tracées

### Contrôles d'accès
- **RBAC** : Rôles et permissions
- **ABAC** : Attributs contextuels (tenant, organisation)
- **Policy** : OPA externe optionnel
- **MFA** : Authentification multi-facteurs obligatoire

---

## Infrastructure et Déploiement

### Docker Compose
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: platform
      POSTGRES_PASSWORD: platform
      POSTGRES_DB: platform_control
    
  postgres-tenant-a:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: platform
      POSTGRES_PASSWORD: tenant_a_secret
      POSTGRES_DB: tenant_a
    
  redis:
    image: redis:7-alpine
    
  rabbitmq:
    image: rabbitmq:3-management-alpine
    
  keycloak:
    image: quay.io/keycloak/keycloak:26.0
    command: start-dev --import-realm
    
  vault:
    image: hashicorp/vault:1.17
    cap_add: [IPC_LOCK]
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: root
```

### Scripts de migration
- **Control plane** : `pnpm migrate:control`
- **Tenant** : `pnpm migrate:tenant <tenant-id>`
- **Seed** : `pnpm seed:local` (complet pour A et B)
- **Keycloak** : `pnpm keycloak:import`

### Configuration
- **Fichier .env** : Variables d'environnement
- **Validation Zod** : `environmentSchema.ts`
- **Vault optionnel** : Pour les secrets en production

---

## Architecture de base de données

### Base de données control plane
- **Nom** : `platform_control`
- **Tables** : tenants, organizations, users, outbox_events, idempotency_keys, audit_logs, etc.
- **Migrations** : `migrations/control-plane/`

### Bases de données tenant
- **Nom** : `tenant_a`, `tenant_b`, etc.
- **Isolation** : Chaque tenant a sa propre instance
- **Migrations** : `migrations/tenant/` (60+ migrations)

### Schéma tenant
```sql
-- tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL,
  status TEXT NOT NULL,
  database JSONB NOT NULL,
  -- ... autres colonnes
);

-- outbox_events (par tenant)
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  max_attempts INTEGER NOT NULL,
  organization_id UUID,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  published_at TIMESTAMP,
  last_error TEXT
);
```

### Transactions
- **Manager de transaction** : `PgTransactionManager`
- **Isolation** : BEGIN/COMMIT/ROLLBACK par tenant
- **Port** : `TransactionManagerPort` abstrait

---

## Stratégie de tests

### Tests unitaires
- **Domain engines** : `inventory-movement.engine`, `loyalty.engine`, etc.
- **FEOFO** : Front-end only, no framework dependencies
- **Coverage** : >90% pour les composants critiques

### Tests d'intégration
- **Testcontainers** : PostgreSQL, RabbitMQ
- **Scénarios multi-tenant** : Base de données séparées
- **Mocks** : Services externes (Keycloak, Vault)

### Tests e2e
- **Scénarios complets** : Flux métier end-to-end
- **Fixtures** : Données de test réalistes
- **Assertions** : Comportement métier

### Tests de charge
- **k6** : Tests de charge HTTP
- **Scénarios** : 1000+ tenants, authz, outbox
- **Métriques** : Latence, débit, erreur rates

### Tests d'architecture
- **Constraints** : Vérification des règles architecturales
- **Dépendance** : Pas de dépendances circulaires
- **Couche** : Séparation stricte domaine/infrastructure

---

## Patterns et décisions clés

### Hexagonal / DDD
- **Ports/Adapters** : Séparation interface/implémentation
- **Use cases** : Orchestration métier sans dépendances frameworks
- **Entités domaine** : Pures, immuables

### DB-per-tenant
- **Avantages** : Isolation stricte, performance, conformité
- **Coûts** : Complexité ops, coût, migrations
- **Atténuation** : Pooling, éviction, circuit breaker

### Outbox pattern
- **Fiabilité** : Publication atomique
- **Idempotence** : Consommation sûre
- **Scalabilité** : Leader election, batch processing

### AsyncLocalStorage
- **Contexte** : Isolation par requête
- **Performance** : Pas de DB par requête
- **Sécurité** : Pas de fuites de données entre requêtes

### Circuit breaker
- **Résilience** : Protection contre les défaillances en cascade
- **Monitoring** : Métriques de santé
- **Fallback** : Dégradation gracieuse

---

## Composants principaux et fichiers

| Composant | Chemin | Rôle |
|-----------|--------|------|
| **Module racine** | `src/app.module.ts` | Racine NestJS (58 imports) |
| **Bootstrap** | `src/main.ts` | HTTP server, middleware, Swagger |
| **Gestionnaire DB** | `src/shared/database/tenant-database.manager.ts` | Pools par tenant |
| **Contexte tenant** | `src/shared/tenancy/tenant-context.service.ts` | Contexte AsyncLocalStorage |
| **Auth Guard** | `src/shared/auth/auth.guard.ts` | Validation JWT + PAT |
| **Outbox Publisher** | `src/shared/messaging/outbox.publisher.ts` | Publication RabbitMQ leader |
| **Idempotence** | `src/shared/idempotency/pg-idempotency.store.ts` | Idempotence HTTP |
| **Catalogue événements** | `src/core/domain/events/event-catalog.ts` | 500+ événements versionnés |
| **Observabilité** | `src/shared/observability/observability.module.ts` | Metrics + Tracing |
| **Audit** | `src/shared/audit/audit.module.ts` | Audit trail interceptor |
| **Migrations** | `migrations/tenant/` | Schéma DB évolutif |
| **Architecture** | `docs/ARCHITECTURE.md` | Documentation d'architecture |

---

## Conclusion

**Platform Core** est une plateforme **mature, production-ready** qui démontre une compréhension approfondie des défis enterprise multi-tenant. Ses forces résident dans :

1. **Architecture propre** : DDD/Hexagonal avec séparation claire des préoccupations
2. **Résilience robuste** : Patterns Outbox/Inbox, circuit breaker, retry
3. **Sécurité complète** : Guards granulaires, MFA, OPA, audit
4. **Tests exhaustifs** : Unitaires → intégration → e2e → load
5. **Observabilité mature** : Logs, metrics, tracing
6. **Documentation complète** : Architecture, autorisation, audit

**Le principal défi** sera l'industrialisation à grande échelle (multi-milliers de tenants) plutôt que la qualité intrinsèque du code, qui est **très professionnelle** et suit les meilleures pratiques.

La plateforme est **prête pour la production** et peut servir de base solide pour des extensions microservices futures sans réécriture métier majeure.