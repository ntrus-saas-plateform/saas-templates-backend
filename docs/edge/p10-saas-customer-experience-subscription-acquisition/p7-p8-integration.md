# P10 — Intégration P7 / P8

## Position

P10 **ne provisionne pas** de tenant IAM, Keycloak realm, ni registry P8.

## Soft links seulement

- Prospect / handoff : `commercial_account_id` (P4) — pas P7 tenant id comme SoT
- Portal snapshot : `provisioningComplete: false` **toujours** côté acquisition (honnête)

## Après conversion

Activation tenant / membership / 360 reste **P7/P8** post handoff P5 réussi.

## Marketing / ops

Pas de couplage P9. Attribution marketing soft-ref optionnelle uniquement.

## Statut

**Boundary respectée.** Aucune API P10 ne crée de tenant.
