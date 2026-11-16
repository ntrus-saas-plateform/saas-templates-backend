# P7.11 — Operations Runbook

## Suspend

1. Ensure Lifecycle Record `ACTIVE` and Activation Record still `ACTIVE`.
2. POST `/edge/lifecycle/records/:id/suspend`.
3. Watch workflow `p711.lifecycle.suspend`; status → `SUSPENDED`.
4. Coordination signals appear under `metadata.coordination` — launch foreign workflows if needed.

## Resume

1. Record must be `SUSPENDED`.
2. POST `.../resume` → `p711.lifecycle.resume` → `ACTIVE`.

## Deprovision

1. Collect export evidence; set `exportEvidenceRef` on record or request body.
2. POST `.../deprovision` with `authorized: true`, `confirmed: true`, `reason`.
3. If flags missing mid-workflow → `WAITING_APPROVAL` (operator task).
4. Realm/data purge remains retention-policy deferred — never silent delete.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Create rejected | Activation not ACTIVE / P7.1 deny / conflict active row |
| Suspend rejected | Not ACTIVE |
| Deprovision 400 | Flags or reason missing |
| WAITING_APPROVAL | Destructive step without flags in snapshot |
