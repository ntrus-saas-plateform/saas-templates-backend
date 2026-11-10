# 02 — OQ-01 Authorization Signature and Trust

| Field | Value |
|-------|-------|
| OQ ID | OQ-01 |
| Title | Asymmetric signature mandatory vs digest+S2S only in v1? |
| Status | RECOMMENDATION_ISSUED / PENDING_HUMAN_DECISION |
| Priority | P0 BLOCKING Gate A |

## Problem

D-TRUST-01 requires message integrity beyond channel auth. Exact crypto strength for v1 is undecided.

## Evidence

| Item | Class |
|------|-------|
| Delta trust model | DOCUMENTED_ONLY |
| Platform JWT/PAT S2S patterns | VERIFIED_IN_CODE (existing Edge/platform auth) |
| Signed provisioning authorization | NOT_IMPLEMENTED |

## Layers (must not conflate)

Channel authenticity · Service authentication · Message authenticity · Message integrity · Freshness · Business validity

## Options

| Opt | Description | Pros | Cons |
|-----|-------------|------|------|
| A | mTLS/S2S JWT + digest only | Simpler | Weaker non-repudiation if queue re-publish spoofed |
| B | Asymmetric payload signature only | Strong message auth | Still need S2S for transport |
| **C** | **Hybrid: S2S + payload_digest + asymmetric signature (EdDSA/ES256)** | Matches threat model | Key mgmt cost |
| D | Digest-only v1, signature v1.1 | Faster start | Residual risk on broker path |

## Recommended Decision (not organizationally accepted)

**Option C for production-bound environments.**  
**Phased Gate A allowance:** Security may approve **Option D for P7.1 lab/dev only** with written residual risk acceptance; production/staging require C before any real auth issuance.

### Controls

- issuer/audience `okapi.edge.p7`  
- key_id + rotation + revoke old keys  
- canonical JSON digest  
- signature over digest  
- expires_at + clock skew ≤ 60s  
- idempotency_key + inbox  
- fail-closed if verify impossible  

### Ownership

| Actor | Duty |
|-------|------|
| P5 | Issue, sign, rotate keys, publish JWKS/key material |
| P7 | Verify S2S + signature/digest + fail-closed |

## Approvers required

Security Architect · P5 Domain Owner · P7 Domain Architect · Engineering Lead

## Acceptance criteria

Threat model signed · algorithm allow-list · key lifecycle · failure matrix · P5/P7 duties explicit · residual risk for any phase-D documented.
