# 32 — Migrations staging / prod checklist

## Edge control-plane (ordre)

1. Appliquer migrations jusqu’à `132` (restaurant commercial + partners si présents ; CS adoption `130`).
2. Seeds : `126` Syntix, `132` Restaurant, policies dunning/geo `128–129`.
3. Vérifier `schema_migrations` rows.
4. Smoke : health API, list plans, cash-truth, cs/aha-moments.

## BB control-plane

1. Jusqu’à `132_edge_entitlement_projection_hash_cs_events`.
2. Confirmer `EDGE_CONTROL_*` frozen/authoritative en prod.
3. Smoke : `/control/v1/ready`, OpenAPI, M2M auth.

## Sign-off ops

| Env | Applied by | Date | OK |
|-----|------------|------|----|
| staging Edge | | | [ ] |
| staging BB | | | [ ] |
| prod Edge | | | [ ] |
| prod BB | | | [ ] |

**Note :** checklist opérationnelle prête ; exécution env = responsabilité ops (case cochée programme quand runbook exécuté).
