# P10 — Subscription form engine

## Objectif

Moteur de formulaires d’**acquisition / candidature** (KYC, onboarding commercial) distinct des forms marketing.

## Agrégats

1. `FormSchema` (`edge_p10_form_schemas`)
2. `FormVersion` (`edge_p10_form_versions`) — `schema_definition` + `condition_rules`
3. `FormPublication` (`edge_p10_form_publications`) — channel + `public_slug`

## Cycle

```
DRAFT schema → create version (DRAFT) → publish version → publication ACTIVE
                ↑ immutable after PUBLISHED
```

## Use-cases livrés

- `CreateFormSchemaUseCase`
- `CreateFormVersionUseCase` + `assertFormVersionMutable`
- `PublishFormVersionUseCase` + création publication + outbox
- `GetPublicFormBySlugUseCase`
- `GetPublishedFormForProductUseCase` (filtre metadata vertical optionnel)
- Validation answers : `validateFormAnswers` / `assertFormAnswersValid` à la sauvegarde / submit

## API

| Route | Auth |
|-------|------|
| `GET/POST edge/acquisition/forms` | Bearer + permissions forms |
| `POST …/forms/:id/versions` | `forms:manage` |
| `POST …/forms/versions/:versionId/publish` | `forms:publish` |
| `GET edge/acquisition/public/forms/:publicSlug` | Public |

## Frontière marketing

`marketing/forms` = campagnes. Soft-ref `marketing_lead_soft_ref` / attribution seulement — **pas** de merge schema.

## Statut

**BE form engine core DONE.** Builder UI FE et runtime `/acquire` **pending**.
