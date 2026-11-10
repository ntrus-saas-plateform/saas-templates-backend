# 03 — Canonical P5 → P7 Provisioning Authorization Contract (DELTA-02)

| Document ID | P7.0-ACK-DELTA-03 | Decision | **D-AUTH-01** |

## Current state (evidence)

| Artifact | Status |
|----------|--------|
| `SubscriptionProvisioningCoordinationPort` / `ProvisioningRequestInput` | PARTIALLY_IMPLEMENTED — ids + correlation only |
| `UnavailableSubscriptionProvisioningAdapter` | VERIFIED_IN_CODE — honest UNAVAILABLE |
| First-class Authorization aggregate | NOT_IMPLEMENTED |
| Event `subscription.provisioning.requested.v1` | VERIFIED_IN_CODE — coordination signal, not full auth |

**P5 owns** the canonical contract. **P7 verifies and persists** a verified copy. P7 must not invent authorizations.

## Canonical authorization object (schema_version `p5.provisioning_authorization.v1`)

See `contracts/p5-p7-authorization.schema.json`.

### Required groups

**Identity:** authorization_id, authorization_version, schema_version, authorization_type, operation, account_id, subscription_id, product_id, product_tenant_id?, correlation_id, causation_id?, idempotency_key  

**Decision:** decision (ALLOW|DENY), authorization_status (ISSUED|ACTIVE|REVOKED|EXPIRED|SUPERSEDED), decision_reason_code, decision_timestamp, issued_at, not_before?, expires_at?  

**Provenance:** entitlement_snapshot_reference, entitlement_version, subscription_version?, commercial_policy_version?, contract_reference?, billing_evaluation_reference?  

**Integrity:** issuer, audience (`okapi.edge.p7`), key_id, signature_algorithm, signature|payload_digest, issued_by_service_identity  

**Revocation block (embedded or separate event):** revocation_status, revocation_version, revoked_at?, revocation_reason_code?, revocation_reference?

## Ownership of changes

| Change | Owner |
|--------|-------|
| Emit full authorization object / events | **P5** (bounded context work) |
| Verify, store, request lifecycle | **P7.1** |
| Extend/replace port input | **P5 + P7** coordinated; do not dump all into P7-only backlog |

## P5 backlog (not P7-only)

- `P5.AUTH.01` Define & version schema  
- `P5.AUTH.02` Issue authorization on eligible commercial state  
- `P5.AUTH.03` Publish issued/revoked/expired/reissued events  
- `P5.AUTH.04` Sync status query API for P7 verify  

## P7.1 backlog mapping

- P7.1.01 store verified authorization  
- P7.1.03 consume after verify  
- P7.1.04 revocation handling  
- P7.1.07 rename/align events per taxonomy  

## Fail-closed

Any missing/invalid/expired/revoked/wrong audience/issuer/version/account/product/subscription/operation → **no new request start**. P5 unavailable when verify required → **deny** (not allow).
