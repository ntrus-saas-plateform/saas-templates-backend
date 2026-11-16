# P10 — Intégration P5 (subscription handoff)

## Règle d’or

**P5 reste la SoT subscription / entitlement.**  
P10 émet un **enregistrement d’orchestration** + événement **outbox** — pas de création directe de lignes subscription P5 dans le repository acquisition.

## Mécanisme

1. `RequestSubscriptionHandoffUseCase`
   - Insert `edge_p10_subscription_handoffs` (`REQUESTED`)
   - Outbox tenant `edge-p10-acquisition`
   - Event `edge.p10.subscription.handoff.requested`
   - Peut passer checkout `CAPTURED` → `HANDOFF_READY`
2. Consommateur externe / wiring Nest (hors repo P10) peut appeler APIs P5
3. `CompleteSubscriptionHandoffUseCase`
   - Exige `subscriptionId` (P5) + `externalEvidenceRef`
   - `assertHandoffCompletable` refuse COMPLETED sans preuve
   - Event `edge.p10.subscription.handoff.completed`

## Ce qui n’est pas fait

- Appel synchrone obligatoire à `CreateSubscriptionUseCase` dans acquisition
- Ownership entitlement / seats
- Fake `CONVERTED` prospect sans handoff evidence

## Commentaire code

Le use-case documente explicitement : injecter éventuellement `CreateSubscriptionFromHandoffUseCase` **au wiring Nest** — jamais inventer des rows subscription dans `AcquisitionRepository`.

## Statut

**Handoff record + outbox DONE.** Consumer P5 end-to-end **à valider hors ce package doc**.
