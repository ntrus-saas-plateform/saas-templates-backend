# 23 — Audit gouvernance données & provenance (P11)

| Champ | Valeur |
|-------|--------|
| Gate F | **PARTIAL → FAIL** entreprise |
| Verdict | Champs provenance **présents** ; lignée cash **faible** |

## Contrôles présents (E3)

Metric snapshots (122) : `definition_version`, `source_provenance`, `data_quality`, `currency`, `as_of`.

Use-cases refusent UNAVAILABLE avec value non-null.

Audit events : `edge_p11_business_audit_events`.

## Échecs gouvernance

| ID | Sévérité | Gap |
|----|----------|-----|
| F-P11-001 | P0 | Snapshots COLLECTED/INVOICED injectables sans lignée P6 calculée |
| F-P11-004 | P1 | Live lines MEASURED + payment UNKNOWN — provenance trompeuse |
| F-P11-018 | P2 | Dual SoT alerts/reports |
| F-P11-033 | P2 | Pas de data catalog / retention policy opérable prouvée |

## Verdict

Doctrine qualité **bonne sur le papier et unit tests**. Gouvernance enterprise (lineage cash, dual-write control) **FAIL**.
