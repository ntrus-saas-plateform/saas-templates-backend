# P7.3 — Runbook opérationnel

## Apply migration

```bash
npm run migrate:control
# expect: Applied 098_edge_p7_placement_capacity_management
```

## Permissions

Après migrate, vérifier grants SUPER_ADMIN / OPERATOR sur :

- `platform:placement:{read,request,evaluate,confirm,cancel}`
- `platform:capacity:{read,manage,reserve,release}`
- `platform:placement_policy:{read,manage}`

## Flux opérateur

1. Provisioning request P7.1 doit être `ACCEPTED` + auth VERIFIED.
2. Créer placement request (idempotency key obligatoire) avec refs registry.
3. Evaluate → décision + candidats + reservation HELD si PLACED.
4. Confirm → reservation COMMITTED (n’active pas le tenant ; n’appelle pas P7.4).
5. Cancel / Release / Expire → libère capacité.

## Capacity freshness

- `valid_until` dépassé → STALE → pas de placement automatique.
- Capacité manquante ≠ illimitée.

## Alertes suggérées

- Taux `NO_CAPACITY` / `REQUIRES_REVIEW`
- Conflits concurrency (version)
- Reservations HELD proches d’expiration
- Evaluations lentes (durée engine)

## Incident overbook suspect

1. Vérifier `edge_p7_capacity_inventory.reserved_capacity` vs somme reservations HELD/COMMITTED.
2. Relancer reconcile expire.
3. Ne pas augmenter capacité sans preuve DECLARED/OBSERVED.
