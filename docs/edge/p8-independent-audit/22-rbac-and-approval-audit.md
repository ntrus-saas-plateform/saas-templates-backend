# 22 — RBAC

**Campagne :** audit indépendant adversarial P8  
**Date :** 2026-11-16  
**Git (début audit) :** backend `feature/console` @ `cd064ee` (ahead, non poussé) · frontend @ `5b83a1b` (P8 console `8bce479` / `225c4a1`)  
**Preuve max observée :** **E2** (Vitest policy/use-cases/auth) — **pas E3/E4/E5**  
**Module pivot :** `src/modules/edge/**/tenant-management/`  
**Migrations :** `108_edge_p8_advanced_tenant_management.sql`, `112_edge_p8_audit_remediation.sql`

## Portée
SoD, mig 112 legal_hold.

## Evidence
E2

## Findings
005 REMEDIATED; F08 OPEN

## Gate
I PARTIAL

## Adversarial
Pas 4-eyes lift hold.

| Gate | Intitulé | Statut |
|------|----------|--------|
| A | Architecture | **PASS** |
| B | Domaine & PG | **PARTIAL** |
| C | API & sécurité | **PARTIAL** |
| D | Ops / P7 exec | **FAIL** |
| E | Console admin | **PASS** |
| F | Intégration | **PARTIAL** |
| G | Résilience/perf | **OPEN** |
| H | E3/E4 | **FAIL** |
| I | Conformité | **PARTIAL** |
| J | Certification | **OPEN** |

