# 07 — Vague 2 (après V1 live)

Préférence : après Phase 5 verte (golden path Pharmacy E2E lab).  
**2026-11-16 :** démarrage code autorisé sur demande explicite ; docker lab reste NEED_LAB_RUN.

## Scope Vague 2

1. Deuxième produit / verticale (ex. Restaurant ou Retail) sur la même chaîne provision. → **CODE_COMPLETE** (`RESTAURANT_LIVE`)
2. Remédiation P11 (moteur COLLECTED/INVOICED, push remote, pack tests 1–25) **après** cash P6 sandbox/live. → moteur + gate **CODE_COMPLETE** ; push / pack lab **NEED_LAB_RUN**
3. Hardening prod : secrets vault, backups DB, SLO, runbooks on-call, go-live checklist. → **DOCUMENTED** [`11-prod-hardening-golive.md`](./11-prod-hardening-golive.md)
4. Multi-PSP (http_webhook + sandbox) et multi-région — hors V1 (toujours ouvert).

Statut détaillé : [`10-vague2-status.md`](./10-vague2-status.md).

## Exit criteria Vague 2

- Deux golden paths produits verts en lab → **NEED_LAB_RUN**
- P11 re-audit au moins READY FOR FINAL RE-AUDIT avec P0 Git résolu → **NOT CLAIMED**
- Checklist prod signée → template prêt, signatures ouvertes
