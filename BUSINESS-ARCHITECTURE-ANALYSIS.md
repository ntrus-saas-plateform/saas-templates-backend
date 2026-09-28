# Analyse d'Architecture Métier - Jarvis Business OS

> **Objectif** : Documenter l'architecture métier (métier = business/domain) de la plateforme Jarvis Business OS, centrée sur les capacités métier, les processus, les données métier, et les règles de gestion.

---

## 1. Vue d'ensemble du modèle métier

La plateforme Jarvis Business OS est une **plateforme SaaS B2B multi-verticales** qui modélise l'ensemble du cycle de vie opérationnel d'une entreprise commerciale :

```
Prospect → Client → Offre → Commande → Stock → Livraison → Facture → Paiement → Fidélité
```

### 1.1 Les 5 grandes verticales métier

| N° | Vertical | Description | Modules |
|----|----------|-------------|---------|
| 1 | **CRM & Customer 360** | Gestion de la relation client, prospection, opportunités | Customer, CRM |
| 2 | **Commerce & Vente** | Catalogue, prix, devis, commandes, ventes | Catalog, Pricing, Sales |
| 3 | **Logistique & Supply Chain** | Stock, entrepôts, réception, picking, expédition | Inventory, Warehouse, Fulfillment |
| 4 | **Pharmacie** | Prescription, dispensation, conformité réglementaire | Pharmacy |
| 5 | **Assurance** | Polices, sinistres, réconciliation, conformité | Insurance |

### 1.2 Les capacités transversales (enablement)

| Capacité | Rôle |
|----------|------|
| **Identity** | Authentification, autorisation, organisations, sessions |
| **Commercial AI / Copilot** | Analyse, recommandations, assistance IA |
| **MCP** | Exposition des capacités métier à des agents IA externes |
| **Workflow Engine** | Orchestration des processus métier |
| **Business Config** | Profils métier, capabilities, politiques par tenant |
| **Delegation** | Sous-traitance, délégation de tâches |
| **Session Management** | Contexte, checkpoints, supervisor |
| **Capability Discovery** | Découverte et évaluation des capacités disponibles |

---

## 2. Architecture par Bounded Contexts (DDD)

Chaque vertical métier est un **Bounded Context** autonome avec ses propres :

- **Domaines** (Domain Model)
- **Règles de gestion** (Business Rules)
- **Entités métier** (Entities)
- **Value Objects** (Value Objects)
- **Use Cases** (Application Layer)
- **Persistence** (Infrastructure Layer)
- **API de présentation** (Presentation Layer)

### 2.1 Structure typique d'un Bounded Context

```
src/modules/<context>/
├── domain/                 # Modèle métier pur (DDD)
│   ├── <entity>.ts         # Entités métier
│   ├── <value-object>.ts   # Value Objects
│   ├── <rules>.ts          # Règles métier
│   └── ports/              # Ports (interfaces)
├── application/            # Use cases (orchestration)
│   ├── <use-case>.ts       # Cas d'utilisation
│   └── idempotency.helper.ts
├── infrastructure/         # Persistence + Handlers
│   ├── <context>-persistence.module.ts
│   └── handlers/             # Handlers événementiels
└── presentation/           # Contrôleurs API
    └── <context>.controller.ts
```

### 2.2 Exemple concret : Inventory

```
src/modules/inventory/
├── domain/
│   ├── stock.entity.ts          # StockLot, AvailabilitySnapshot
│   ├── inventory.use-cases.ts   # ReceiveStock, Allocate, Pick
│   ├── fefo.allocator.ts        # Règle FEFO
│   ├── quality-expiration.rules.ts
│   └── ports/inventory-repository.port.ts
├── application/
│   ├── inventory.use-cases.ts   # Use cases métier
│   └── idempotency.helper.ts
├── infrastructure/
│   ├── inventory-persistence.module.ts
│   └── inventory-repository.ts
└── presentation/
    ├── inventory.controller.ts
    ├── inventory-ops.controller.ts
    └── inventory-platform.controller.ts
```

---

## 3. Les Domaines Métier Détaillés

### 3.1 Domaine : Catalogue (Catalog)

**Responsabilité** : Décrire les produits, articles, SKUs, variantes, et règles de substitution.

#### Entités principales
- **Product** : Entité parente (article commercial)
- **SKU** : Variante commercialisable (référence, barcode, prix)
- **Kit** : Bundle de SKUs
- **Substitution** : Règle d'échange SKU
- **Barcode** : Identification produit
- **Meta** : Métadonnées produit

#### Règles métier
- Un SKU appartient à un produit parent
- Les kits sont composés de SKUs
- Les barcodes sont uniques au tenant
- Les substitutions sont hiérarchisées

#### Use cases
- `CreateProduct`, `UpdateProduct`
- `CreateSKU`, `UpdateSKU`
- `CreateKit`, `UpdateKit`
- `CreateSubstitution`, `UpdateSubstitution`

---

### 3.2 Domaine : Pricing

**Responsabilité** : Calculer les prix, remises, et grilles tarifaires.

#### Entités principales
- **PriceList** : Grille tarifaire
- **PriceRule** : Règle de prix
- **Discount** : Remise
- **Tax** : Taxe
- **Quote** : Devis

#### Règles métier
- Priorité des grilles tarifaires
- Calcul des remises (hiérarchisé)
- Arrondi et taxes
- Validité temporelle des prix

#### Use cases
- `CreatePriceList`, `UpdatePriceList`
- `CalculatePrice`, `Quote`
- `ApplyDiscount`, `ValidateQuote`

---

### 3.3 Domaine : Sales (Commandes)

**Responsabilité** : Gérer le cycle de vie de la commande client.

#### Entités principales
- **SalesOrder** : Commande client
- **SalesOrderItem** : Ligne de commande
- **Invoice** : Facture
- **Payment** : Paiement
- **CreditNote** :avoir

#### États de la commande
```
DRAFT → CONFIRMED → PROCESSING → SHIPPED → COMPLETED
                         │
                         └── CANCELLED / REFUNDED
```

#### Règles métier
- Confirmation = validation prix + stock
- Facturation après livraison partielle/totale
- Paiement doit couvrir le montant facturé
- Annulation = libération des réservations stock

#### Use cases
- `CreateOrder`, `ConfirmOrder`
- `CancelOrder`, `CompleteOrder`
- `CreateInvoice`, `CreatePayment`
- `CreateCreditNote`

---

### 3.4 Domaine : Inventory (Stock)

**Responsabilité** : Gérer le stock physique, lots, réservations, et disponibilité.

#### Entités principales
- **StockLot** : Lot de stock (SKU, quantité, date expiration)
- **StockLocation** : Emplacement physique
- **InventoryReservation** : Réservation
- **InventoryAllocation** : Allocation
- **AvailabilitySnapshot** : Vue ATP/CTP

#### États du lot
```
RECEIVED → AVAILABLE → RESERVED → ALLOCATED → PICKED → SHIPPED
    │
    └── QUARANTINED / BLOCKED / EXPIRED / RECALLED / DESTROYED
```

#### Règles métier
- **FEFO** : First Expired, First Out
- **ATP** : Available To Promise = sellable - reserved - protected + inbound
- **Allocation** : Réservation prioritaire pour commandes
- **Quarantaine** : Blocage qualité
- **Rappel** : Rappel produit (pharmacie)

#### Use cases
- `ReceiveStock`, `MoveStock`, `AdjustStock`
- `ReserveStock`, `AllocateStock`, `ReleaseReservation`
- `Pick`, `Pack`, `Ship`
- `CalculateAvailability`, `CalculateATP`

---

### 3.5 Domaine : Warehouse (Entrepôt)

**Responsabilité** : Gérer les opérations logistiques d'entrepôt.

#### Entités principales
- **Warehouse** : Site logistique
- **WarehouseDock** : Quai de réception/expédition
- **WarehouseReceiving** : Réception
- **WarehousePutawayTask** : Mission de rangement
- **WarehouseTask** : Tâche générique
- **WarehouseShipment** : Expédition
- **WarehousePackingSession** : Session de packing

#### Processus
```
Réception → Contrôle → Putaway → Stockage → Picking → Packing → Expédition
```

#### Règles métier
- Capacité des docks
- Priorité des tâches
- Optimisation du putaway
- Cohérence entre picking et stock
- Traçabilité des mouvements

#### Use cases
- `CreateWarehouse`, `CreateDock`
- `CreateReceiving`, `MarkReceivingComplete`
- `CreatePutawayTask`, `CompletePutawayTask`
- `CreatePickWave`, `CompletePickWave`
- `CreateShipment`, `MarkShipmentShipped`

---

### 3.6 Domaine : Fulfillment

**Responsabilité** : Orchestration de la livraison (transporteur, tracking).

#### Entités principales
- **FulfillmentPlan** : Plan de livraison
- **Shipment** : Colis
- **TrackingEvent** : Événement de tracking
- **Carrier** : Transporteur

#### Use cases
- `CreateFulfillmentPlan`
- `CreateShipment`, `MarkShipmentShipped`
- `UpdateTrackingEvent`

---

### 3.7 Domaine : Customer / CRM

**Responsabilité** : Gestion de la relation client et pipeline commercial.

#### Entités principales
- **Customer** : Client
- **Organization** : Organisation client
- **CustomerContact** : Contact
- **Opportunity** : Opportunité commerciale
- **Lead** : Prospect
- **Membership** : Membre d'organisation

#### États du pipeline
```
PROSPECT → QUALIFIED → OPPORTUNITY → WON → LOST
```

#### Règles métier
- Attribution d'un account manager
- Scoring et qualification
- Conversion lead → opportunity
- Historique des interactions

#### Use cases
- `CreateCustomer`, `UpdateCustomer`
- `CreateOpportunity`, `WinOpportunity`, `LostOpportunity`
- `CreateLead`, `QualifyLead`
- `ListMyMemberships`

---

### 3.8 Domaine : Pharmacy (Pharmacie)

**Responsabilité** : Dispensation de médicaments avec conformité réglementaire.

#### Entités principales
- **PharmacyLocation** : Point de vente pharmaceutique
- **PharmacyPrescription** : Prescription
- **PharmacyDispensing** : Dispensation
- **PharmacyContraindicationRule** : Règle d'interaction
- **PharmacyClinicalSafetyCheck** : Contrôle clinique
- **PharmacyWave** : Vague de dispensation

#### Processus de dispensation
```
Prescription → Validation → Contrôle clinique → Dispensation → Décrément stock
```

#### Règles métier critiques
- **Prescription obligatoire** pour certains médicaments
- **Contrôles d'interaction médicamenteuse**
- **FEFO strict** pour les lots périmés
- **Sérialisation** obligatoire (pharmacovigilance)
- **Validation pharmacien** pour produits contrôlés
- **Quotas** de dispensation
- **Compensation** en cas d'échec

#### Use cases
- `DispenseMedication`
- `ValidatePrescription`
- `CheckContraindications`
- `ManagePharmacyWave`

---

### 3.9 Domaine : Insurance (Assurance)

**Responsabilité** : Gestion des polices d'assurance et sinistres.

#### Entités principales
- **InsurancePolicy** : Police d'assurance
- **InsuranceClaim** : Sinistre
- **InsuranceReconciliation** : Réconciliation
- **InsurancePremium** : Prime

#### Processus
```
Souscription → Émission police → Encaissement prime → Sinistre → Indemnisation
```

#### Règles métier
- Couverture géographique
- Exclusions
- Franchises
- Réconciliation avec tiers
- Conformité réglementaire

#### Use cases
- `CreatePolicy`, `UpdatePolicy`
- `CreateClaim`, `ProcessClaim`
- `ReconcilePolicy`

---

### 3.10 Domaine : Finance Commercial

**Responsabilité** : Facturation, paiements, et comptabilité commerciale.

#### Entités principales
- **Invoice** : Facture
- **Payment** : Paiement
- **CreditNote** : Avoir
- **AccountsReceivable** : Client
- **AccountsPayable** : Fournisseur

#### Règles métier
- **Immutabilité** des factures (pas de modification)
- Paiement partiel / multiple
- Validation des paiements mixtes
- Avoirs liés aux factures
- Réconciliation comptable

#### Use cases
- `CreateInvoice`, `ValidateInvoice`
- `CreatePayment`, `ApplyPayment`
- `CreateCreditNote`
- `ReconcileAccount`

---

## 4. Les Flux Métier Transverses (Workflows)

### 4.1 Flux Vente Complet

```
1. Création devis (Pricing)
2. Confirmation commande (Sales)
3. Réservation stock (Inventory)
4. Allocations (Inventory)
5. Préparation (Warehouse)
6. Expédition (Fulfillment)
7. Facturation (Finance)
8. Paiement (Finance)
9. Livraison (Fulfillment)
10. Fidélisation (Loyalty)
```

### 4.2 Flux Réception Fournisseur

```
1. Création PO (Purchasing)
2. Réception (Warehouse)
3. Contrôle qualité (Inventory)
4. Putaway (Warehouse)
5. Stock disponible (Inventory)
6. Facture fournisseur (Finance)
```

### 4.3 Flux Pharmacie

```
1. Prescription patient
2. Validation pharmacien
3. Contrôle clinique
4. Dispensation (Inventory)
5. Traçabilité (Audit)
6. Renouvellement
```

---

## 5. Architecture des Données Métier

### 5.1 Modèles de données par vertical

| Vertical | Tables principales | Clés étrangères |
|----------|-------------------|----------------|
| Catalog | products, skus, kits, substitutions | product_id → sku_id |
| Inventory | stock_lots, reservations, allocations | sku_id, warehouse_id, lot_id |
| Sales | sales_orders, order_items, invoices | order_id, customer_id |
| Warehouse | warehouses, docks, tasks, shipments | warehouse_id, task_id |
| Customer | customers, organizations, opportunities | organization_id, customer_id |
| Pharmacy | prescriptions, dispensings, locations | prescription_id, location_id |
| Insurance | policies, claims, reconciliations | policy_id, claim_id |

### 5.2 Schéma relationnel clé

```
Tenant
 └── Organization
      ├── Customer
      │    └── Opportunity
      └── Product (Catalog)
           └── SKU
                └── StockLot (Inventory)
                     ├── InventoryReservation
                     └── InventoryAllocation
          └── SalesOrder
               ├── SalesOrderItem
               │    └── Invoice
               │         └── Payment
               └── Shipment (Fulfillment)
                    └── TrackingEvent
```

### 5.3 Concepts communs

#### `CommercialExecutionContext`
Contexte transverse fourni à tous les use cases :

```typescript
interface CommercialExecutionContext {
  tenantId: string;
  organizationId: string;
  userId: string;
  requestId: string;
  correlationId: string;
  idempotencyKey?: string;
}
```

#### `PolicyBundle`
Politiques métier par tenant :

```typescript
interface PolicyBundle {
  inventory: InventoryPolicy;
  pharmacy: PharmacyPolicy;
  warehouse: WarehousePolicy;
  pricing: PricingPolicy;
  // ... autres politiques
}
```

---

## 6. Les Règles de Gestion (Business Rules)

### 6.1 Règles de validation

#### Validation des entrées
- Champs obligatoires
- Types de données
- Bornes (quantité > 0, prix >= 0)
- Formats (dates, UUID, emails)

#### Validation métier
- État logique du processus
- Permissions utilisateur
- Capabilities activées
- Politiques tenant

### 6.2 Règles de transition d'état

Exemple : `StockLot`

```typescript
RECEIVED → AVAILABLE        (réception validée)
AVAILABLE → RESERVED        (réservation commande)
RESERVED → ALLOCATED        (allocation picking)
ALLOCATED → PICKED          (préparation)
PICKED → SHIPPED            (expédition)
```

Toute transition non valide = `DomainError`.

### 6.3 Règles de cohérence

#### Cohérence stock
- Quantité on-hand >= 0
- Reserved <= OnHand
- Allocated <= Reserved
- Sellable = OnHand - Reserved - Blocked

#### Cohérence financière
- Total facturé = Somme lignes
- Total payé <= Montant facturé
- Avoir <= Montant facturé

---

## 7. Les Patterns Métier Spécifiques

### 7.1 Capability-Based Architecture

Chaque vertical expose des **capabilities** activables par tenant :

```typescript
interface Capability {
  id: string;
  name: string;
  description: string;
  status: 'available' | 'disabled';
  requiredPermissions: string[];
}
```

#### Exemple : Inventory
```typescript
const capabilities = [
  { id: 'FEFO_ALLOCATION', name: 'Allocation FEFO', status: 'available' },
  { id: 'QUARANTINE', name: 'Quarantaine', status: 'available' },
  { id: 'SERIALIZATION', name: 'Sérialisation', status: 'available' },
];
```

### 7.2 Business Configuration

Le module `BusinessConfig` permet de configurer les profils métier :

```typescript
interface BusinessProfile {
  id: string;
  name: string;
  capabilities: string[];
  policies: PolicyBundle;
  workflows: string[];
}
```

### 7.3 Idempotence Métier

Chaque use case expose une clé d'idempotence :

```typescript
interface IdempotencyKey {
  tenantId: string;
  operation: string;      // 'RECEIVE', 'DISPENSE', 'ALLOCATE'
  payload: string;        // Hash du payload
  result: unknown;        // Résultat stocké
}
```

### 7.4 Sagas Métier

Les opérations complexes sont orchestrées par sagas :

```typescript
interface Saga {
  id: string;
  name: string;
  status: 'RUNNING' | 'COMPLETED' | 'COMPENSATED' | 'FAILED';
  steps: SagaStep[];
  compensation?: SagaStep[];
}
```

Exemple : **Pharmacy Dispense Saga**
```
1. Valider prescription
2. Vérifier stock
3. Décrémenter stock
4. Enregistrer dispensation
5. Émettre événement
```

Compensation :
```
1. Annuler dispensation
2. Remonter stock
3. Marquer échec
```

---

## 8. Les Événements Métier

### 8.1 Catalogue d'événements

Le projet expose un catalogue d'événements métier versionnés :

```typescript
interface BusinessEvent {
  id: string;
  type: string;           // 'stock.reserved', 'order.completed'
  version: number;
  tenantId: string;
  organizationId: string;
  occurredAt: Date;
  payload: unknown;
}
```

### 8.2 Exemples d'événements

| Événement | Émis par | Conséquence |
|-----------|----------|-------------|
| `stock.received` | Inventory | Met à jour stock |
| `order.confirmed` | Sales | Déclenche réservation |
| `stock.reserved` | Inventory | Bloque disponibilité |
| `shipment.shipped` | Fulfillment | Met à jour commande |
| `invoice.created` | Finance | Déclenche comptabilité |
| `dispensing.completed` | Pharmacy | Traçabilité réglementaire |

### 8.3 Outbox

Les événements sont publiés via l'Outbox pour garantir la fiabilité :

```
Use Case → Commit DB → Outbox → Publisher → RabbitMQ → Consommateurs
```

---

## 9. Les Capabilities Métier Détaillées

### 9.1 Capability : Inventory

| Capability | Description |
|-----------|-------------|
| `FEFO_ALLOCATION` | Allocation des lots selon FEFO |
| `QUARANTINE` | Mise en quarantaine |
| `SERIALIZATION` | Traçabilité par numéro de série |
| `EXPIRATION_TRACKING` | Suivi des dates de péremption |
| `ATP_CALCULATION` | Calcul du disponible à promettre |
| `CONSIGNMENT` | Stock consignataire |

### 9.2 Capability : Pharmacy

| Capability | Description |
|-----------|-------------|
| `PRESCRIPTION_REQUIRED` | Prescription obligatoire |
| `PHARMACIST_VALIDATION` | Validation pharmacien |
| `CLINICAL_SAFETY_CHECK` | Contrôle interactions |
| `DISPENSING_VERIFICATION` | Vérification dispensation |
| `CONTROLLED_SUBSTANCES` | Produits contrôlés |
| `FEFO_STRICT` | FEFO strict |

### 9.3 Capability : Warehouse

| Capability | Description |
|-----------|-------------|
| `RECEIVING` | Réception marchandises |
| `PUTAWAY` | Rangement |
| `PICKING` | Préparation de commandes |
| `PACKING` | Emballage |
| `SHIPPING` | Expédition |
| `DOCK_MANAGEMENT` | Gestion quais |

### 9.4 Capability : Sales

| Capability | Description |
|-----------|-------------|
| `QUOTATION` | Devis |
| `ORDER_MANAGEMENT` | Gestion commandes |
| `INVOICING` | Facturation |
| `PAYMENT_COLLECTION` | Encaissement |
| `CREDIT_NOTE` | Avoirs |

---

## 10. Les Verticales Spécialisées

### 10.1 Vertical : Pharmacy

La vertical pharmacie est la plus réglementée :

#### Spécificités
- Prescriptions électroniques
- Traçabilité complète des lots
- Contrôle des interactions médicamenteuses
- Produits stupéfiants/contrôlés
- Pharmacovigilance
- Renouvellement d'ordonnance

#### Architecture spécifique
```
PharmacyModule
 ├── PharmacyPersistenceModule
 ├── PharmacyApplicationProviders
 ├── PharmacyController
 ├── PharmacyLocationScopeResolver
 └── Handlers événementiels
```

### 10.2 Vertical : Warehouse

#### Spécificités
- Gestion multi-docks
- Optimisation du putaway
- Picking par vague
- Expédition multi-colis
- Intégration transporteurs

### 10.3 Vertical : Insurance

#### Spécificités
- Polices et primes
- Sinistres
- Réconciliation avec tiers
- Conformité réglementaire

---

## 11. Architecture d'Intégration Métier

### 11.1 Flux de données entre verticales

```
Catalogue ────────→ Pricing ────────→ Sales
   │                   │                │
   └───────────────────┼────────────────┘
                       ▼
              Inventory (Stock)
                       │
                       ▼
              Warehouse / Fulfillment
                       │
                       ▼
              Finance (Facturation)
                       │
                       ▼
              Loyalty (Fidélité)
```

### 11.2 Dépendances inversées

Pour éviter les couplages forts :

- Les domaines exposent des **Ports** (interfaces)
- Les use cases dépendent des ports
- Les repositories implémentent les ports
- Les events découples les verticales

### 11.3 Événements asynchrones

Les verticales se communiquent via événements :

```
SalesOrderCompleted → InventoryReservationRelease
ShipmentShipped → InvoiceCreation
DispensingCompleted → AuditTrail
```

---

## 12. Les Processus d'Orchestration

### 12.1 Orchestration par Workflow Engine

Le module `Workflow` gère les processus métier déclaratifs :

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  version: number;
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  transitions: WorkflowTransition[];
}
```

### 12.2 Orchestration par Saga

Pour les processus longs avec compensation :

```typescript
interface SagaDefinition {
  id: string;
  name: string;
  stateMachine: StateMachine;
  compensationStrategy: CompensationStrategy;
}
```

### 12.3 Orchestration par Events

Pour les découplages forts :

```
Event → Handler → Use Case → Persistence
```

---

## 13. Les Règles de Gouvernance Métier

### 13.1 Séparation des responsabilités (SoD)

- Création et validation doivent être séparées
- Dispensation nécessite pharmacien
- Paiement nécessite validation financière
- Annulation nécessite justification

### 13.2 Auditabilité

Chaque opération métier critique est tracée :

- Qui ? (utilisateur)
- Quand ? (timestamp)
- Quoi ? (action)
- Pourquoi ? (justification)
- Résultat ? (succès/échec)

### 13.3 Traçabilité

- Historique des états
- Historique des modifications
- Historique des paiements
- Historique des prescriptions

---

## 14. Les KPIs Métier

### 14.1 KPIs Sales

- Chiffre d'affaires
- Taux de conversion
- Panier moyen
- Taux d'annulation
- Délai de traitement commande

### 14.2 KPIs Inventory

- Taux de rotation stock
- Taux de rupture
- Précision du stock
- Coût de possession
- Taux de péremption

### 14.3 KPIs Warehouse

- Taux de préparation à temps
- Taux d'erreur picking
- Coût par commande
- Productivité par opérateur

### 14.4 KPIs Pharmacy

- Taux de dispensation conforme
- Délai de traitement prescription
- Taux d'interactions détectées
- Taux de péremption

### 14.5 KPIs CRM

- Taux de conversion lead
- Cycle de vente moyen
- Valeur pipeline
- Activité commerciale par utilisateur

---

## 15. Conclusion

L'architecture métier de Jarvis Business OS est **domain-driven**, organisée autour de **bounded contexts** autonomes (Catalog, Pricing, Sales, Inventory, Warehouse, Fulfillment, Customer/CRM, Pharmacy, Insurance, Finance).

### Points forts
- **Découpage domain clair** par vertical métier
- **Règles métier encapsulées** dans les domaines
- **Use cases transactionnels** bien structurés
- **Événements métier** pour découpler les verticales
- **Capabilities** pour configurer les fonctionnalités par tenant
- **Workflows et sagas** pour orchestrer les processus longs
- **Idempotence** pour garantir la fiabilité des opérations

### Points d'attention
- **Complexité des dépendances** entre verticales (Sales ↔ Inventory ↔ Finance)
- **Gouvernance des règles métier** à maintenir dans le temps
- **Performance des requêtes** sur gros volumes de stock
- **Conformité réglementaire** pharmacie à documenter précisément

Le modèle est **solide et évolutif**, capable de supporter l'ajout de nouvelles verticales métier via le système de **capabilities** et de **business configuration**.
