# 32 — Audit UX & accessibilité (P11)

| Champ | Valeur |
|-------|--------|
| Scope | Console `/edge/revenue` |
| a11y automated | **NOT executed** |
| Verdict | MVP utilisable ; enterprise a11y **non prouvé** |

## Observations UX (E3)

Positif :

- Forbidden state explicite si pas `revenue:read` ni `business:read`
- Retention fallback documente l’indisponibilité sans inventer des chiffres
- Tabs filtrés par permission

Négatif :

| ID | Sévérité | Issue |
|----|----------|-------|
| F-P11-010 | P1 | Overview visible avec `business:read` → appel API `revenue:read` (403 probable) |
| F-P11-011 | P1 | IA incomplète (~12 sections absentes) — charge cognitive / fausse complétude |
| F-P11-037 | P3 | Pas d’audit axe/wcag automatisé cet audit |
| F-P11-038 | P3 | Densité tabs / empty states UNAVAILABLE non standardisés design-system wide |

## Verdict

UX **acceptable MVP**. Accessibilité et complétude IA **FAIL** certification.
