# 07 — Qualification & enterprise acquisition (remediation)

## Qualification

- Un `QualificationRecord` / application
- `StartQualificationUseCase` (`review`) → `DecideQualificationUseCase` (`approve`)
- États : `PENDING` → `IN_PROGRESS` → `APPROVED|REJECTED|CONDITIONAL` → …
- `assertSeparationOfDuties` — self-approve interdit quand invoqué
- Assignments : REVIEWER / APPROVER / DOCUMENT_REVIEWER / QUALIFIER

## Enterprise / quote

- `price_display_mode` `QUOTE_REQUIRED` | `ENTERPRISE_CUSTOM`
- `CreateQuoteRequest` → `QuoteReference` → `AcceptQuote` → path handoff
- Parcours technique conditionnel couvert P10-S21…S23
- Pas de pricing inventé dans P10 — refs commerciales uniquement

## Non livré

File d’attente SLA, auto-assign intelligent, UI review queue riche.

## Statut

BE core + scénarios **DONE** ; UX ops avancée **MVP / deferred**.
