# 15 — Open Questions and Exceptions

| Document ID | P7.0-ACK-DELTA-15 |

## Open (non-blocking for Delta accept; may block effective P7.1)

| ID | Question | Owner |
|----|----------|-------|
| OQ-01 | Asymmetric signature mandatory vs digest+S2S only in v1? | Security — prefer signature; allow phased if threat model approved |
| OQ-02 | Default policy: reuse Product Tenant after terminate vs always new? | Product+P5 |
| OQ-03 | Multi environment_slot per account+product — commercial offer? | Product |
| OQ-04 | Sync revoke API path/SLA when P5 down during accept? | P5+P7 — fail-closed already |
| OQ-05 | Timeline for deprecating `subscription.provisioning.requested.v1` | P5 |

## Exceptions

None granted that weaken fail-closed auth or Identity≠product tenant rules.
