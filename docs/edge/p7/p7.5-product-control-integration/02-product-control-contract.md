# P7.5 — Product Control Contract

Canonical discovery document fields (strict parse via `parseDiscoveryDocument`):

`productId`, `productCode`, `productControlId`, `productControlVersion`, protocol/contract/capability/operation arrays, auth + signature algorithms, callback/idempotency/correlation flags, `healthStatus`, `contractFingerprint`, `issuedAt`, `expiresAt`.

Rules:

- HTTP 200 alone never proves contract compatibility (`isHttpSuccessProofOfCompatibility` → false).
- Product ID must match the registered endpoint (`assertProductIdMatches`).
- Expired discovery rejected (`assertDiscoveryNotExpired`).
- Compatibility evaluated against required contract version (`evaluateContractCompatibility`).

Negotiated snapshots persist in `edge_p7_product_control_negotiated_contracts` (distinct from P7.2 published `edge_p7_product_control_contracts`).
