# Insurance Events (Waves 1–3)

Registered in `event-catalog.ts`. Mutations use transactional outbox + `commercialEvent`.

| Event | When |
|-------|------|
| `insurance.policy.created.v1` | Policy created |
| `insurance.policy.activated.v1` | Policy activated |
| `insurance.membership.created.v1` | Membership created |
| `insurance.eligibility.checked.v1` | Eligibility evaluated |
| `insurance.authorization.requested.v1` | Prior auth requested |
| `insurance.authorization.decided.v1` | Prior auth decided |
| `insurance.claim.created.v1` | Claim drafted |
| `insurance.claim.submitted.v1` | Claim submitted |
| `insurance.claim.acknowledged.v1` | Payer channel ack |
| `insurance.claim.rejected.v1` | Claim rejected |
| `insurance.claim.adjudicated.v1` | Adjudication recorded |
| `insurance.claim.partially_approved.v1` | Partial approval |
| `insurance.claim.approved.v1` | Approved |
| `insurance.claim.denied.v1` | Denied |
| `insurance.claim.appealed.v1` | Appeal submitted |
| `insurance.claim.paid.v1` | Paid / remitted (incl. finance inbox) |
| `insurance.reconciliation.detected.v1` | Scan or payment inbox opened discrepancies |
| `insurance.reconciliation.resolved.v1` | Discrepancy RESOLVED / DISMISSED |

Consumed (not owned): `finance.payment.received.v1` → insurance inbox handler.
