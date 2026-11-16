# P10 — Scenario evidence (mandat §27.6)

**Nature honnête :** `domain/application scenario suite`  
**Pas** de live browser E2E (Playwright/Cypress) pour les 40 scénarios.  
Chaque scénario est un test Vitest exécutable contre des fakes in-memory (`AcquisitionRepositoryPort`, `ProductRepositoryPort`, `CommercialRepositoryPort`, storage, notification, `CreateSubscriptionUseCase`).

## Commande

```bash
pnpm exec vitest run src/modules/edge/application/acquisition/acquisition-scenarios.spec.ts
```

## Résultat d’exécution

| Métrique | Valeur |
|----------|--------|
| Suite | `acquisition-scenarios.spec.ts` |
| Scénarios mandat | **40 / 40 Pass** (`P10-S01` … `P10-S40`) |
| Tests Vitest | **41** (40 scénarios + ledger d’évidence) |
| Exit code | `0` |
| Date | 2026-11-16 |

## Matrice des 40 scénarios

| ID | Scénario | Couverture | Statut |
|----|----------|------------|--------|
| P10-S01 | Visitor discovers available product | `ListPublicProductDiscovery` + `AVAILABLE` | Pass |
| P10-S02 | Unavailable product cannot be subscribed | `INTERNAL_ONLY` / `UNAVAILABLE` exclus | Pass |
| P10-S03 | Compare eligible plans | `ListPlanPresentations` status `PUBLISHED` | Pass |
| P10-S04 | Product-specific form loaded | `GetPublicFormBySlug` | Pass |
| P10-S05 | Segment-specific form fields | schema metadata `segment` | Pass |
| P10-S06 | Conditional fields behave | `evaluateCondition` / `validateFormAnswers` | Pass |
| P10-S07 | Backend rejects invalid submission | `SaveApplicationAnswers` validation | Pass |
| P10-S08 | Draft saved and resumed | Create + Save + get | Pass |
| P10-S09 | Draft retains original schema version | bound `formVersionId` | Pass |
| P10-S10 | Published schema immutable | `assertFormVersionMutable` | Pass |
| P10-S11 | New form version does not alter apps | application keeps bound version | Pass |
| P10-S12 | Prospect registers → CONTACTED | `CreateProspect` + transition | Pass |
| P10-S13 | Duplicate prospect detection | `PROSPECT_DUPLICATE_EMAIL` | Pass |
| P10-S14 | Organization profile on prospect metadata | `metadata.organization` | Pass |
| P10-S15 | Documents registered securely | private locator, no http URL | Pass |
| P10-S16 | Malicious/invalid document quarantined | `mock_infected` / bad content-type | Pass |
| P10-S17 | Reviewer requests missing information | → `DOCUMENTS_PENDING` | Pass |
| P10-S18 | Customer submits missing information | save + → `IN_REVIEW` | Pass |
| P10-S19 | Reviewer accepts document | `ReviewDocument` ACCEPTED | Pass |
| P10-S20 | Product-specific qualification | Start + Decide APPROVED | Pass |
| P10-S21 | Enterprise technical review path | CONDITIONAL → APPROVED + quote | Pass |
| P10-S22 | Quote request created | `CreateQuoteRequest` | Pass |
| P10-S23 | Proposal acceptance → handoff | `AcceptQuote` + `RequestSubscriptionHandoff` | Pass |
| P10-S24 | Plan revalidated with commercial port | `RevalidatePlanBeforeCheckout` | Pass |
| P10-S25 | Changed price needs confirmation | `PLAN_REVALIDATION_CONFIRMATION_REQUIRED` | Pass |
| P10-S26 | Checkout session idempotent | same `idempotencyKey` | Pass |
| P10-S27 | P6 payment request (ref only) | `AttachPaymentReference` | Pass |
| P10-S28 | Payment failure visible | `RecordPaymentResult` FAILED | Pass |
| P10-S29 | Duplicate callback no duplication | CAPTURED replay rejected | Pass |
| P10-S30 | P5 handoff accepted | `CompleteSubscriptionHandoff` | Pass |
| P10-S31 | P5 rejection reflected | handoff `FAILED` | Pass |
| P10-S32 | Timeout reconciled without duplicate | idempotent correlation | Pass |
| P10-S33 | Provisioning from authoritative refs | portal `provisioningComplete: false` | Pass |
| P10-S34 | Customer cannot mark provisioning complete | no mark API | Pass |
| P10-S35 | Multiple subscriptions / products | two `CreateSubscription` | Pass |
| P10-S36 | Single subscription one product | `assertSingleProductSubscription` | Pass |
| P10-S37 | Unauthorized contact cannot view apps | empty list / not found | Pass |
| P10-S38 | Unauthorized document grant denied | storage adapter FORBIDDEN | Pass |
| P10-S39 | Analytics strip secrets | `RecordAnalyticsEvent` | Pass |
| P10-S40 | Complete journey → subscription ref | draft→submit→approve→checkout→handoff | Pass |

## Evidence runtime

Chaque `it('P10-Sxx…')` pousse `{ id, pass, expected, actual }` dans un tableau module-level.  
`afterAll` logue le JSON d’évidence sur stdout.  
Le test `evidence ledger covers all 40 scenarios` vérifie les IDs `P10-S01`…`P10-S40` et `pass === true` pour tous.

## Limites (honnêtes)

- Pas de browser / HTTP live / DB réelle dans cette suite.
- Storage malware = fake (`INFECTED` / content-type reject).
- Handoff P5 COMPLETED via use-case + refs inventoriées (pas consumer Nest live).
- Pour un audit « live E2E 40 », il faudrait une campagne Playwright + environnements intégrés — hors scope de ce fichier.
