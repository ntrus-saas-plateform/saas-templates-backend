# P2 API reference (implemented)

Namespace: `/api/v1/edge/commercial/**`  
Auth: Edge session + `EdgePermissionGuard`  
Envelope: `{ data: ... }`

## Markets & research
| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/markets` | markets:read / markets:manage |
| GET/POST | `/markets/:id/assessments` | markets:read / markets:manage |
| GET/POST | `/research-projects` | markets:read / markets:manage |
| POST | `/research-projects/:id/sources` | markets:manage |
| POST | `/research-projects/:id/complete` | markets:manage |

## Segmentation
| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/segment-intelligence` | markets:read / markets:manage |
| POST | `/segment-intelligence/:segmentId/score` | markets:manage |

## ICP / personas / committees
| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/icps` | icp:manage |
| GET/POST | `/personas` | personas:manage |
| GET/POST | `/buying-committees` | personas:manage |
| GET/POST | `/decision-journeys` | personas:manage |
| GET/POST | `/value-propositions` | value_props:manage |

## Packages / plans / add-ons / enterprise
| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/packages` | packages:read/manage |
| POST | `/packages/:id/capabilities` | packages:manage |
| GET/POST | `/plans` | plans:read/manage |
| POST | `/plans/:id/capabilities` | plans:manage |
| POST | `/plans/:id/readiness` | readiness:evaluate |
| POST | `/plans/:id/publish` | offers:publish |
| GET/POST | `/addons` | catalog:read / addons:manage |
| POST | `/addons/:id/plans` | addons:manage |
| GET/POST | `/enterprise-templates` | plans:read/manage |

## Pricing
| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/pricing-units` | pricing:read/manage |
| GET/POST | `/pricing-models` | pricing:read/manage |
| GET/POST | `/usage-metrics` | pricing:read/manage |
| GET/POST | `/price-books` | pricing:read/manage |
| POST | `/price-books/:id/entries` | pricing:manage |
| POST | `/pricing/preview` | pricing:read |
| GET/POST | `/discount-policies` | discounts:manage |

## Eligibility / configurator / catalog views
| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/eligibility-policies` | catalog:read / catalog:manage |
| POST | `/offers/configure` | catalog:read |
| GET | `/catalog?view=` | catalog:read |
| GET | `/publication-snapshots` | catalog:read |
| POST | `/packages/:id/publish` | offers:publish |
| POST | `/price-books/:id/publish` | offers:publish |

Views: `GLOBAL` | `VERTICAL` | `PRODUCT` | `PUBLISHED` | `INTERNAL`  
Publication creates immutable snapshots. Configurator never grants entitlements.
