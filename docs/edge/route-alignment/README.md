# Edge — Alignement routes Backend ↔ Frontend

**Vague BE↔FE routes : CLOSED** (2026-11-18) — `uncoveredConsole: 0`, CI `--check` fail-closed, lab golden + doc 44 PASS.

## Documents

| Fichier | Contenu |
|---|---|
| [edge-backend-routes.md](./edge-backend-routes.md) | Inventaire **complet** des handlers Nest Edge (`/api/v1/...`) |
| [edge-frontend-routes.md](./edge-frontend-routes.md) | Pages App Router + BFF + méthodes `edgeApi` |
| [edge-be-fe-alignment-plan.md](./edge-be-fe-alignment-plan.md) | Écarts + plan d’alignement avancé (anti-MVP) |
| [ALIGNMENT-PROGRESS.md](./ALIGNMENT-PROGRESS.md) | Suivi d’exécution — vague routes **CLOSED** |
| [ALIGNMENT-AUDIT-2026-11-18.md](./ALIGNMENT-AUDIT-2026-11-18.md) | Audit honnête couverture + MVP restant |
| [edge-console-out-of-scope.md](./edge-console-out-of-scope.md) | Handlers Nest exclus de la console |
| `edge-routes.extract.json` | Export machine (CI / diff) |

## Régénération / CI fail-closed

```bash
cd saas-templates-backend
pnpm edge:routes:extract   # écrit les 4 artifacts
pnpm edge:routes:check     # exit 1 si drift
pnpm edge:routes:diff      # uncoveredConsole / beOnly / feOnly
pnpm edge:routes:diff -- --strict  # exit 1 si uncoveredConsole > 0
```

Job CI `edge-route-alignment` : `--diff` informatif + `--check` **fail-closed**.

## E2E P0

```bash
# BE (skip sans lab) — route-existence handshake/health
pnpm test:e2e:p0
# Lab : EDGE_API_URL=http://localhost:3000 pnpm test:e2e:p0:lab

# FE (Playwright) — gate sign-in + CSRF
cd ../saas-template-frontend && pnpm test:e2e:p0
```
