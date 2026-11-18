# 07 — Checklist PR Edge (RGOM)

Cocher dans la description de PR avant merge.

## Doctrine

- [ ] Respecte ADR-021 (1 Product Tenant = 1 produit)
- [ ] Ne vend / n’inclut pas de capability `Planned` comme Available
- [ ] Configurator ne grant pas d’entitlements (`grantsEntitlements: false` si touché)
- [ ] Pas d’invention de prix / TAM / métriques MEASURED sans lignée

## Provisioning / entitlements

- [ ] Aucun adapter **prod** ne pousse `entitlements: {}`
- [ ] `EDGE_P7_PROVISIONING_ADAPTER=lab_bb` non utilisé en production
- [ ] Tests ajoutés ou mis à jour pour le chemin touché

## Qualité

- [ ] Tests unitaires / e2e pertinents verts
- [ ] Docs `rgom-alignment` mises à jour si comportement contrat
- [ ] Pas de secrets dans le diff
