# P7.13 — Operations Runbook

## Create & observe

1. Ensure migration **109** applied (do not use 108 — reserved by P8).
2. Create policy (`autoRemediate` default false, `requireApproval` true).
3. Create run with optional desired snapshot + auth binding.
4. POST observe — if provider down, set `providerUnreachable: true`.
5. Review findings: UNKNOWN → quarantine or wait for re-observe.

## Remediate

1. Confirm remediation plan is reversible for auto path.
2. POST remediate or approve waiting remediations.
3. Verify evidence shows `foreignDestructorsInvoked: false`.

## Waivers

- Always set future `expiresAt`.
- Expired waivers are ignored automatically.

## Console

`/edge/provisioning/reconciliation` — Runs / Policies / History tabs.
