# P7.3 — Revue sécurité

**Date :** 2026-11-10  
**Périmètre :** Placement & Capacity (pas de provisioning infra / P7.4)

## Contrôles

| Contrôle | Statut |
|----------|--------|
| Auth Edge + permissions granulaires | OK — `platform:placement:*`, `platform:capacity:*`, `platform:placement_policy:*` |
| Identité commerciale depuis P7.1 auth view uniquement | OK — fail-closed si non ACCEPTED/VERIFIED/ALLOW |
| Pas de confiance FE pour entitlement/product claims | OK |
| ValidationPipe whitelist + forbidNonWhitelisted | OK |
| PATCH DTOs dédiés | OK |
| Atomicité mutation+history+audit+outbox | OK — pattern P7.2 `runWithOutbox` |
| Anti-overbook `SELECT … FOR UPDATE` | OK — prouvé intégration |
| Idempotency keys | OK |
| Override manuel ne bypasse pas residency/security/certification | OK — hard constraints engine |
| Pas de secrets plaintext | OK |
| Pas de création DB/Keycloak/infra | OK — hors scope |

## Verdict

**Acceptable pour audit code P7.3** sous réserve apply migrate 098 + smoke HTTP live staging + signature G1.
