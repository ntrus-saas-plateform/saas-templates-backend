# P9 — Plan d’implémentation

## Séquence (mandate §32)

| Phase | Contenu | Migration cible |
|-------|---------|-----------------|
| P9.0 | Baseline + docs | — |
| P9.1 | Service catalog, ownership, deps, API, console | **115** |
| P9.2 | Health overview, monitoring ports, alerts | **116** (packagée) |
| P9.3 | Incidents + major incident | **116** |
| P9.4 | Problems / RCA | **116** |
| P9.5 | Change / release / maintenance | **116** |
| P9.6 | Support / tasks / on-call | **116** |
| P9.7 | SLO / capacity | **116** |
| P9.8 | Backup / DR coordination | **116** |
| P9.9 | Runbooks / status pages | **116** |
| P9.10 | Risk / exceptions / automation | **116** |
| P9.11 | Analytics / governance | **116** |
| P9.12 | Cross P5–P8 + hardening + E2E | partiel (auth/smoke) |

## Permissions (préfixe)

`platform:operations:*` et domaines spécialisés :

- `platform:service_catalog:read|manage|export`
- `platform:operations:health:read`
- *(phases suivantes)* `platform:incidents:*`, `platform:alerts:*`, …

## Routes API (convention Edge)

Préfixe réel : `edge/operations/...` (global prefix API v1 Edge existant).

Exemples P9.1 :

- `GET/POST edge/operations/services`
- `GET/PATCH edge/operations/services/:id`
- `POST edge/operations/services/:id/dependencies`
- `GET edge/operations/services/:id/dependencies`

## Critères de non-faux-positif

Une sous-phase n’est **pas** « done » si seules les pages UI existent.  
Gates A–J du mandate §33 s’appliquent à l’acceptation finale.
