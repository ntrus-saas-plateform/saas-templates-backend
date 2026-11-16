# P9 — Platform Operations & Service Management

**Programme :** Okapi Edge Control Plane  
**Phase :** P9  
**Branche :** `feature/console`  
**Repos :** Ops Control Plane enterprise — catalogue de services, santé, incidents, changements, fiabilité — **sans** dupliquer P5/P6/P7/P8.

## État

| Sous-phase | Statut |
|------------|--------|
| P9.0 Baseline | **DONE** |
| P9.1 Service Catalog | **DONE (fondation)** — mig 115, API, console, tests unit/auth |
| P9.2 … P9.12 | PENDING |

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
