# 44 — Lab e2e checklist Retail / Hospitality (`bb_control`)

**Statut :** CLOSED (probes PASS) — subscription Edge opérateur / ModuleGuard live encore hors harness  
**Adapters :** `EDGE_P7_PROVISIONING_ADAPTER=bb_control`  
**Script :** `pnpm lab:e2e:retail` · `pnpm lab:e2e:hospitality` · `pnpm lab:e2e:retail-hospitality`  
**Prérequis :** BB `pnpm migrate:control` (078/079/132 — `content_hash`) + `EDGE_BB_CONTROL_TOKEN` = `EDGE_CONTROL_LAB_TOKEN`

## Retail (`OKAPI_RETAIL_LITE` → SUPERMARKET)

1. Migrate Edge **133–138** + BB control **133** (warm pool optional OFF).  
2. Créer subscription Edge avec plan `OKAPI_RETAIL_LITE` (opérateur — pas public).  
3. Confirmer entitlements snapshot non vide (`commercialPlanEntitlementSnapshot`).  
4. PAID → RequestProvisioning avec `profile_code=SUPERMARKET` / `product_code=OKAPI_RETAIL`.  
5. Poll ready → publish → activate.  
6. BB : ModuleGuard retail/inventory/pos OK.  
7. Coller evidence (request ids, tenant id, durée) ici :

| Champ | Valeur |
|-------|--------|
| Date lab | 2026-11-18 |
| Env | local — `EDGE_BB_CONTROL_BASE_URL=http://127.0.0.1:3100` |
| Auth | OK (discover 200) — `EDGE_BB_CONTROL_TOKEN=lab-token` |
| subscriptionId | — (provision control/v1 direct, pas Edge subscription) |
| tenantId | `t_1b96e701-5d7c-45d1-8299-419a51001a92` |
| provision | **201** — status `provisioned`, profile `SUPERMARKET`, entitlements_accepted |
| ready | **200** `ready=true` (v1) → after PUT v2 still ready |
| modules | identity / retail / inventory / pos (shadow) |
| empty entitlements | rejected (4xx) |
| duration_ms | ~6653 |
| result | **PASS** |
| Note | sellable=false conservé ; pas de bascule AVAILABLE |

## Hospitality (`OKAPI_HOSP_LITE` → HOTEL_HOSPITALITY)

Même séquence avec `profile_code=HOTEL_HOSPITALITY`, caps front_desk/hospitality.

| Champ | Valeur |
|-------|--------|
| Date lab | 2026-11-18 |
| Env | local — BB up + migrate:control |
| Auth | OK (discover 200) |
| tenantId | `t_b71ee32e-faae-4892-bee8-55ccc985feea` |
| provision | **201** — profile `HOTEL_HOSPITALITY` |
| ready | **200** `ready=true` (v1→v2) |
| modules | identity / hospitality / front_desk (shadow) |
| entitlements | 5 caps catalog, sellable=false |
| duration_ms | ~8562 |
| result | **PASS** |

## Golden handshake→health (plateforme)

`pnpm lab:golden:handshake` → **PASS** (discover / identity / health / ready, token lab).

## Règles

- Ne pas basculer `commercial_availability=AVAILABLE` sans evidence + sign-offs G11.  
- Warm pool OFF pour ce lab froid (mesure cold create).  
- `/tenants/:id/ready` 403 « Access denied » sur tenant inconnu = anti-énumération (`TENANT_NOT_FOUND`), **pas** BLOCKED_AUTH si `/discover` = 200.  
