# 05 — Customer journeys (remediation)

## Modèle

- `JourneyDefinition` — steps / metadata
- `JourneyInstance` — liée application
- `JourneyEvent` — append-only
- Advance : `AdvanceJourneyUseCase` (manuel ; permission `governance:manage`)

## Parcours métier couverts (scénarios)

Discovery → form → draft/submit → docs → qualification → quote (enterprise) → checkout → payment ref → handoff P5 → portal snapshot / analytics.

Evidence : `acquisition-scenarios.spec.ts` **P10-S01…S40**.

## Timers / automation

**Non livré** — pas de timers SLA automatiques ni GDPR erase journey. Advance manuel uniquement.

## FE

Onglet journeys console + shells publics ; pas de designer de journey graphique.

## Statut

Core journey record **DONE** ; automation **deferred**.
