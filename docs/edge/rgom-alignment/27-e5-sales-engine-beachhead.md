# 27 — E5 Sales engine beachhead

## Pipeline

Voir `sales-engine-beachhead.ts` — stages NEW→WON/LOST avec exit criteria observables.

## BANT + scoring

- BANT complet requis avant DEMO.
- Lead score Fit/Intent/Engagement/Readiness — UNAVAILABLE ≠ 0.

## Discovery templates

- `DISC_SYNTIX_PHARMA` / `DISC_OKAPI_RESTAURANT` / `DISC_OKAPI_RETAIL` / `DISC_OKAPI_HOSPITALITY` (mig **140**, status **DRAFT**)

## Demo scripts (workflows, pas menus)

1. Pharmacy : first sale / dispensation path  
2. Wholesale : price list → first order  
3. Restaurant : menu → first ticket → shift close  

## Quote / proposal

Toujours lié snapshot configurator (`grantsEntitlements: false`) + price book DRAFT (pas de prix inventé MEASURED).

## Lost reasons

Taxonomy exportable Product Marketing / Sales Ops / GTM.

## Handoff Won → Contract → Subscription

Idempotent via P5/P10 paths existants ; signature/calendar adapters = UNAVAILABLE honest si secrets absents.
