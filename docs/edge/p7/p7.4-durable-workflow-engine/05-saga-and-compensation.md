# P7.4 — Saga & compensation

`orderSteps` — deterministic topo order. `compensationOrder` — reverse dependency order over successfully completed compensatable steps only.

Policies via `decideFailureAction`: `CONTINUE|RETRY|COMPENSATE|PAUSE_FOR_REVIEW|FAIL_WITHOUT_COMPENSATION`.
