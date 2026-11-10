# P7.4 — Worker execution & leases

Claim/persist in TX (`FOR UPDATE SKIP LOCKED`) → execute registered handler outside TX → persist outcome with fencing + idempotency.

`assertFencingToken(expected, provided)` requires exact match; claim bumps token via `nextFencingToken`.

Future provisioning keys use `UnavailableProvisioningHandler` → always `DEPENDENCY_UNAVAILABLE`.
