# 01 — Périmètre et méthodologie

**Campagne :** audit indépendant adversarial P8  
**Date :** 2026-11-16  
**Git (début audit) :** backend `feature/console` @ `cd064ee` (ahead, non poussé) · frontend @ `5b83a1b` (P8 console `8bce479` / `225c4a1`)  
**Preuve max observée :** **E2** (Vitest policy/use-cases/auth) — **pas E3/E4/E5**  
**Module pivot :** `src/modules/edge/**/tenant-management/`  
**Migrations :** `108_edge_p8_advanced_tenant_management.sql`, `112_edge_p8_audit_remediation.sql`

## In / out

In : backend P8, console tenant-management, migrations 108/112, specs E2.  
Out : push remote, P6 live, exécution P7 prod.

## Méthode

Revue statique adversarial, tests E2 max, pas E3/E4/E5.

| E1 doc | E2 unit/auth | E3 PG | E4 E2E | E5 ops |
|--------|--------------|-------|--------|--------|
| Oui | **Max** | Non | Non | Non |
