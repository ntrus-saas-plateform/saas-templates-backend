# 04 — Authorization Trust and Validation (DELTA-03)

| Document ID | P7.0-ACK-DELTA-04 | Decision | **D-TRUST-01** |

## Threat model (summary)

| Threat | Mitigation |
|--------|------------|
| Spoofed P5 caller | S2S auth (JWT client credentials / mTLS) |
| Tampered payload | payload_digest + signature over canonical JSON |
| Replay | idempotency_key + authorization_version + expires_at + inbox dedup |
| Cross-audience use | audience = `okapi.edge.p7` |
| Key compromise | key_id rotation; revoke old keys |
| Confused deputy | explicit account/product/subscription checks |
| P5 outage as allow | fail-closed |

## Trust layers

1. **Channel:** authenticated Edge internal / service identity (existing platform patterns — EXTEND).  
2. **Message:** integrity of authorization body (digest mandatory; asymmetric signature **preferred** for cross-boundary non-repudiation).  

Channel alone is insufficient if messages are queued/replayed via outbox.

## P7 verification order (frozen)

1. Authenticate caller  
2. Verify issuer + audience  
3. Validate schema_version supported  
4. Verify integrity (digest/signature + key_id)  
5. Load authorization_id + authorization_version uniqueness  
6. Check decision == ALLOW  
7. Check authorization_status ∈ {ISSUED, ACTIVE}  
8. Check not_before / expires_at (clock skew ≤ configured, e.g. 60s)  
9. Check revocation (local cache + sync if required)  
10. Check account/product/subscription consistency  
11. Check operation allowed  
12. Check idempotency_key  
13. Persist Provisioning Request (+ verified auth copy) atomically with outbox  

Adjust only with documented threat-model change (ACR).
