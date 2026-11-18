# 31 — Backup / restore posture

## Périmètre

| Store | Fréquence cible | RPO | RTO |
|-------|-----------------|-----|-----|
| Control-plane Postgres (Edge) | Quotidien + WAL | ≤ 24h | ≤ 4h |
| BB control-plane + tenant DBs | Quotidien + WAL | ≤ 24h | ≤ 4h |
| Object storage (docs acquisition) | Versioning bucket | ≤ 24h | ≤ 8h |

## Restore drill

1. Restaurer snapshot control-plane lab.
2. Vérifier `schema_migrations` aligné (126–132 Edge ; 078/132 BB).
3. Republish dernière projection entitlements connue (jamais `{}`).
4. `GET …/ready` fail-closed jusqu’à projection appliquée.
5. Cash-truth + drift-scan = evidence pack.

## Interdits

- Restore partiel qui invente MEASURED cash.
- Activer `lab_bb` ou empty entitlements en prod pour « débloquer » ready.
