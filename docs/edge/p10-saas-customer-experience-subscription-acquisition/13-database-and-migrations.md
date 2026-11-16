# 13 — Database & migrations (remediation)

## Chaîne P10 / consent

| Migration | Rôle | Evidence |
|-----------|------|----------|
| **117** `edge_p10_acquisition_foundation` | Tables `edge_p10_*` (~31), permissions seed SUPER_ADMIN | Applied — `migration-apply-evidence.md` |
| **118** | P9 remediation ops (hors P10 fonctionnel) | Applied dans même run evidence |
| **119** `edge_p10_acquisition_role_grants` | Grants `EDGE_PLATFORM_OPERATOR` | Applied (+ fix `schema_migrations` INSERT) |
| **120** `edge_marketing_consent_not_provided` | CHECK state + `NOT_PROVIDED` | Fichier présent ; apply sur env cibles à confirmer |
| **121** | — | **Absent** au moment du package remédiation |

## Apply evidence (lab)

Runner : `pnpm migrate:control` sur Postgres 16 éphémère `:55432` → 117+118+119 clean.

```sql
-- p10 versions
117_edge_p10_acquisition_foundation
119_edge_p10_acquisition_role_grants
-- tables edge_p10_* ≈ 31
```

## Actions restantes

- Appliquer **120** sur env cibles (avec 117/119)
- Suite Testcontainers concurrency / E3 : **incomplete**
- Pas de mig 121 dans le tree actuel

## Statut

Fondation P10 + grants **evidenced** ; consent mig 120 **coded**, apply multi-env **pending**.
