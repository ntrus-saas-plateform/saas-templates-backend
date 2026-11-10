# P7.5 — Runbook

## Migrate

```bash
npm run migrate:control
# Applied 100_edge_p7_product_control_integration
```

## Ops console

`/edge/provisioning/product-controls`

## Endpoints

1. Register endpoint (registry refs only) → PENDING_VALIDATION  
2. Validate / Handshake / Discover / Health  
3. ACTIVE only after successful handshake+contract  
4. Quarantine / Revoke bloque le dispatch  

## Credentials

`credential_ref` opaque uniquement — jamais de secret en clair.

## Réconciliation

`UNKNOWN_OUTCOME` → reconcile avant retry mutatif (P7.5 n’exécute pas d’ops mutatives).

## Handlers workflow

`product_control.handshake|discover_contract|discover_capabilities|verify_connectivity|verify_health|verify_conformance`  
Mutatives / P7.6+ → `OPERATION_NOT_IMPLEMENTED`
