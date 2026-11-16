# P7.15 — Failure & Recovery

| Failure | Recovery |
|---------|----------|
| Required evidence MISSING/FAILED at certify | Attach/verify evidence; re-assemble; retry certify |
| P7.1 auth deny (bound provisioningRequestId) | Fix trust material; revalidate |
| Lease / fencing failure | Retry via worker with valid claim |
| Assemble leaves FAILED | Fix blocking items; assemble again → READY |
| Accidental CERTIFIED | Revoke (clears CERTIFIED); never silent re-certify in compensate |
