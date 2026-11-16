# P7.12 — Coordination Signals

Advance / coord_verify handlers record **local coordination signals** only:

- Evidence outcome `SUCCEEDED` with `coordination: SIGNAL`, `foreignPortsInvoked: false`.
- Step status → `PASSED` for COORDINATION / VERIFY / SYSTEM kinds.
- Does **not** call experience / infra / product-control / CRM mutators.

HANDOVER sets `handover_evidence_ref` vault-style (`vault://onboarding-handover/{journeyId}/{ts}`) — reference only, not a business invite.

Never invent CRM contacts, business memberships, or `Subscription.ACTIVE`.
