# P9 — Platform Operations & Service Management

**Programme :** Okapi Edge Control Plane  
**Phase :** P9  
**Branche :** `feature/console`  
**Objectif :** Ops Control Plane enterprise — catalogue de services, santé, incidents, changements, fiabilité — **sans** dupliquer P5/P6/P7/P8.

## État

| Sous-phase | Statut |
|------------|--------|
| P9.0 Baseline | **DONE** |
| P9.1 Service Catalog | **DONE** — mig 115, API, console, tests unit/auth |
| P9.2 Health / alerts | **DONE (core)** — mig 116, snapshots, alerts ack/resolve |
| P9.3 Incidents | **DONE (core)** — create / transition / major |
| P9.4 Problems | **DONE (core)** — RCA + link incident + list |
| P9.5 Change / maintenance | **DONE (core)** — SoD approve/reject + schedule |
| P9.6 Tasks / on-call | **DONE (core)** — rotations stockées, pas de paging |
| P9.7 SLO / capacity | **DONE (core)** — mesures durable |
| P9.8 Recovery | **DONE (core)** — evidence obligatoire pour VERIFIED |
| P9.9 Runbooks / status | **DONE (core)** — SoD publication, pas de CDN public |
| P9.10 Risk / automation | **DONE (core)** — exceptions + execute après approve |
| P9.11 Analytics | **DONE (core)** — comptages DB ; intégrations `UNAVAILABLE` si non configurées |
| P9.12 Hardening / cohérence FE↔BE | **PARTIAL** — contrats alignés, aliases mandat, auth/smoke ; pas gates A–J ACCEPTED |

**Verdict courant :** `P9 PARTIALLY IMPLEMENTED`

## Remotes

| Repo | Remote réel |
|------|-------------|
| Backend | `https://github.com/ntrus-saas-plateform/saas-templates-backend.git` |
| Frontend | `https://github.com/ntrus-saas-plateform/saas-template-frontend.git` |

## Documents

Voir les fichiers de ce dossier (`00-baseline` → architecture, bounded contexts, plan, etc.).

## Règles non négociables

- Pas de fausse télémétrie / statut healthy sans observation.
- Pas d’ownership P5/P6/P7/P8.
- Unknown ≠ Healthy.
- Autorisation serveur obligatoire.
