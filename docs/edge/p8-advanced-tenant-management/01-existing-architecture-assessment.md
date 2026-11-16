# 01 — Existing Architecture Assessment

## Hexagonal / Modular Monolith Edge

Okapi Edge est un modular monolith NestJS :

- `domain/` — entités, ports, policies, events
- `application/` — use cases
- `infrastructure/` — PG repositories, live executors, adapters
- `presentation/` — controllers + DTO (class-validator)

Wiring : `edge.module.ts` + `edge-application.providers.ts` + `edge-persistence.module.ts`.

## Ce qui existe déjà (réutilisable)

### Identity (hors Edge)

- Table `tenants` + `TenantStatus` + saga provisioning plateforme
- APIs `api/tenants/*`, `api/admin/tenants/*`
- **Ne pas** fusionner avec le product tenant P8

### P5 Subscription

- `edge_subscriptions`, entitlements, coordination provisioning (`tenant_ref`)
- Ports : `subscription-repository`, `provisioning-coordination`, `p5-authorization-status`
- API `edge/subscriptions`

### P6 Billing

- `edge_billing_*` ancré account/subscription
- Références financières lisibles pour 360° ; pas de moteur billing dans P8

### P7 Technical chain (095–107)

| Phase | Capacité | Lien tenant |
|---|---|---|
| P7.1 | Provisioning auth | `product_tenant_id` |
| P7.2 | Product/platform registry | **pas** tenant registry |
| P7.3–P7.4 | Placement + durable workflows | contexte tenant |
| P7.5–P7.7 | Product control, infra, Keycloak | `tenant_id` |
| P7.8–P7.9 | Config / experience | assignments par tenant |
| P7.10 | Activation | readiness + activation records |
| P7.11 | Technical lifecycle | suspend/resume/deprovision |
| P7.12 | Onboarding | journeys |

### Patterns transverses

- Control-plane outbox (`EDGE_P7_OUTBOX_TENANT`)
- Audit durable obligatoire sur mutations
- Idempotency-Key + correlation ID
- RBAC `platform:*` via `RequireEdgePermissions`
- Optimistic locking (`version`)

## Défauts architecturaux observés

1. Pas de **bounded context** transversal « tenant administration ».
2. Confusion possible Identity tenant vs product tenant (mitigée par ADR, pas par code registry).
3. Permissions migrate/recover SQL présentes, API lifecycle incomplète.
4. Réconciliations siloées sans hub findings.
5. Console tenant absente ; nav « Coming soon ».

## Conclusion

P8 doit **ajouter** une couche de gouvernance/agrégation, **réutiliser** P5/P6/P7 via ports, et **ne pas** réécrire Identity ni les moteurs P7.
