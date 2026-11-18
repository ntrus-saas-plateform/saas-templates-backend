# 07 — Billing lifecycle (invoice / payment / credit)

**Statut :** ACTIVE — RGOM-E8  
**SoT :** Edge Billing (P6). HyperSwitch / PSP = orchestration only.

## Flux canonique

1. **Cadence** — `POST /edge/billing/cadence` (`MONTHLY` | `ANNUAL` | `ENTERPRISE_CONTRACT` | …) + setup fee optionnel dans `commercialSnapshot`.
2. **Draft invoice** — depuis subscription : lignes `RECURRING` + `SETUP_FEE` (one-time, première facture seulement).
3. **Approve → Issue** — document immuable ; montants = invoiced (pas collected).
4. **Payment intent** — adapter (`sandbox` | `http_webhook` | `hyperswitch`) ; seul `SUCCEEDED` compte en collected.
5. **Échec paiement** — pas de settle, pas de `billingConfirmed`, pas d’activation silencieuse.
6. **Credit note** — réduit le solde sans inventer un refund PSP.
7. **Refund** — sur intent SUCCEEDED uniquement ; reconciliation sépare exceptions.

## Anti-patterns

- Égaliser contracted / invoiced / collected dans l’UI
- Traiter HyperSwitch comme catalogue de plans/prix
- Activer après intents `FAILED` only
