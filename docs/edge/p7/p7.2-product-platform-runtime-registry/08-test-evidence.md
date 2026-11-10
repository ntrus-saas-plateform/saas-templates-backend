# P7.2 — Preuves de tests

## Suites exécutées (réel)

### Backend registry domain

```bash
npm run test:edge:registry
```

| Champ | Valeur |
|-------|--------|
| Date | 2026-11-10 |
| Exit code | 0 |
| Résumé | Test Files 2 passed / Tests 10 passed |

### Backend provisioning (non-régression P7.1)

```bash
npm run test:edge:provisioning
```

| Champ | Valeur |
|-------|--------|
| Exit code | 0 |
| Résumé | Test Files 11 passed / Tests 55 passed |

### Backend typecheck

```bash
npm run typecheck
```

| Champ | Valeur |
|-------|--------|
| Exit code | 0 |

### Migration file check

```bash
npm run check:registry:migrations
```

| Champ | Valeur |
|-------|--------|
| Exit code | 0 |
| Output | OK: registry migration file present |

### Frontend registry helper tests

```bash
npm test -- --run lib/edge/registry.test.ts
```

| Champ | Valeur |
|-------|--------|
| Exit code | 0 |
| Résumé | Test Files 1 passed / Tests 4 passed |

### Frontend typecheck

Erreurs TS préexistantes sur `edge/sales/*` et `edge/subscriptions/[id]` — **hors périmètre P7.2**. Pages registry non listées dans ces erreurs.

### Migration DB runtime

`npm run migrate:control` / `check:provisioning:migrations` : authentification CP DB (`28P01`) non disponible dans cet environnement — **exécution schema_migrations 096 PENDING**.
