# P10 — API contracts

## Console (Bearer + Edge permissions)

Préfixe : `edge/acquisition/…`

| Méthode | Path | Permission |
|---------|------|------------|
| GET | `overview` | read |
| GET/POST | `products` | read / manage |
| POST | `products/:id/content` | manage |
| POST | `products/:id/content/:versionId/publish` | manage |
| GET/POST | `plans`, `segments` | read / manage |
| GET/POST | `prospects` | read / manage |
| POST | `prospects/:id/transition` | manage |
| GET/POST | `leads` | read / manage |
| POST | `leads/:id/promote` | manage |
| GET/POST | `forms` | read / forms:manage |
| POST | `forms/:id/versions` | forms:manage |
| POST | `forms/versions/:versionId/publish` | forms:publish |
| GET/POST | `applications` | read / manage |
| POST | `applications/:id/answers\|submit\|transition\|request-information` | manage / review |
| POST | `documents`, `documents/:id/review` | manage / documents:review |
| POST | `document-requirements` | forms:manage |
| POST | `qualification/start`, `qualification/:id/decide` | review / approve |
| POST | `quotations`, `…/references`, `…/accept` | quotes:manage |
| POST | `checkout`, `…/payment-reference`, `…/payment-result`, `checkout/revalidate-plan` | checkout:operate |
| POST | `handoffs`, `handoffs/:id/complete` | checkout:operate |
| GET | `journeys/:applicationId` | read |
| POST | `journeys/:id/advance` | governance:manage |
| GET | `customer-portal/:prospectId` | read |
| POST/PATCH | `communications`, `…/:id/status` | governance:manage |
| POST/GET | `analytics/events`, `analytics/funnel` | manage / analytics:read |

## Public

| Méthode | Path | Notes |
|---------|------|-------|
| GET | `edge/acquisition/public/products` | CommercialAvailability filter |
| GET | `edge/acquisition/public/products/:slug` | |
| GET | `edge/acquisition/public/plans` | PUBLISHED |
| GET | `edge/acquisition/public/forms/:publicSlug` | |
| POST | `edge/acquisition/public/leads` | throttle 20/min |
| POST | `edge/acquisition/public/analytics/events` | throttle 120/min |

## DTOs

`presentation/dto/acquisition.dto.ts` — bodies validés côté Nest.

## Statut

**Contrats BE câblés.** Client FE `edgeApi` acquisition **absent**.
