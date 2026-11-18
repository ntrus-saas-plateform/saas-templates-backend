# 33 — Load smoke provision / ready

## Objectif

Valider que provision → entitlements → ready reste fail-closed sous charge modérée beachhead.

## Procédure (lab/staging)

```bash
# 1) N provisions séquentielles (N=20 beachhead)
# 2) PUT entitlements non vides chaque tenant
# 3) GET ready doit passer uniquement si projection appliquée
# 4) Mesurer p95 latency provision + ready
```

## Critères PASS beachhead

| Métrique | Seuil |
|----------|-------|
| ready false sur empty entitlements | 100% |
| p95 GET ready | ≤ 2s staging |
| Erreurs 5xx provision | 0 sur N=20 nominal |
| Drift dirty non remédié | 0 après republish |

## Evidence

Joindre timestamps + logs correlationId au evidence pack go-live.

```bash
# Dry (sans BB URL) → SKIPPED checklist JSON
pnpm load-smoke:provision-ready

# Live staging
EDGE_BB_CONTROL_BASE_URL=https://bb.example EDGE_CONTROL_BEARER=… LOAD_SMOKE_N=20 \
  pnpm load-smoke:provision-ready
```

Script : `scripts/load-smoke-provision-ready.ts` — refuse `lab_bb` en production ; empty entitlements doivent être rejetés.
