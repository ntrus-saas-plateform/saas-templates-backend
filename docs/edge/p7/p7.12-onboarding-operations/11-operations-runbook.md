# P7.12 — Operations Runbook

## Create journey

1. Ensure P7.10 Activation Record is `ACTIVE`.
2. Optionally publish an onboarding template.
3. `POST /edge/onboarding/journeys` with `activationRecordId`.
4. `POST .../start` → workflow materializes steps → `IN_PROGRESS`.

## Advance

1. `POST .../advance` while `IN_PROGRESS`.
2. HUMAN step → journey `WAITING_APPROVAL` + OPEN task.
3. COORD/VERIFY → signal PASSED locally.
4. HANDOVER → vault-style `handover_evidence_ref`.

## Decide human task

1. `POST .../tasks/:taskId/decide` with `APPROVE` or `REJECT`.
2. P7.1 must revalidate — approval cannot bypass auth.
3. On APPROVE, step PASSED and journey returns `IN_PROGRESS`.

## Close

1. All required steps must be PASSED.
2. `POST .../close` → `CLOSING` → `CLOSED`.

## Do not

- Invent CRM contacts or business invites from onboarding.
- Set commercial `Subscription.ACTIVE` from this module.
- Close with incomplete required steps.
