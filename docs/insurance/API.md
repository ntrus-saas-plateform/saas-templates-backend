# Insurance API (Waves 1–3)

Base: `/api/v1/insurance` — `@RequiresCapability('INSURANCE')`

## Master / policy

| Area | Paths | Permission | Extra capability |
|------|-------|------------|------------------|
| Providers / payers / plans | `POST /providers`, `/payers`, `/plans` | `insurance:configuration.manage` | PROVIDER / PAYER / PLAN |
| Policies | `POST /policies`, `POST /policies/:id/activate`, `GET /policies/:id` | `insurance:policy.manage` / `read` | `INSURANCE_POLICY` |
| Memberships | `POST /memberships` | `insurance:membership.manage` | `MEMBERSHIP` |
| Eligibility | `POST /eligibility/check` | `insurance:eligibility.check` | `ELIGIBILITY` |

## Claims / auth / adjudication (Waves 1–2)

| Area | Paths | Permission | Extra capability |
|------|-------|------------|------------------|
| Claims | `POST /claims`, ready, submit, `GET /claims`, `GET /claims/:id` | claim.create / submit / read | `CLAIMS` / `CLAIM_SUBMISSION` |
| Authorization | `POST /authorizations`, decide | `insurance:authorization.request` | `INSURANCE_AUTHORIZATION` |
| Adjudicate / appeal | `POST /claims/:id/adjudicate`, appeal, appeal transition | adjudicate / appeal | `CLAIM_ADJUDICATION` / `CLAIM_DENIAL` |
| Contracts / networks / tariffs | `POST /contracts`, `/networks`, `/tariffs` | `insurance:configuration.manage` | CONTRACTS / NETWORK / TARIFFS |
| Attachments / CoB / limits | attachments, cob/secondary, limit consume | claim.* | ATTACHMENTS / ADJUDICATION / COVERAGE_LIMITS |
| Denials | `GET /denials` | `insurance:read` | `CLAIM_DENIAL` |
| KPIs | `GET /kpis` | `insurance:read` | `INSURANCE_ANALYTICS` |

## Reconciliation (Wave 3)

| Path | Permission | Capability |
|------|------------|------------|
| `GET /reconciliation/discrepancies` | `insurance:reconciliation.manage` | `CLAIM_RECONCILIATION` |
| `POST /reconciliation/scan` | same | same |
| `POST /reconciliation/discrepancies/:id/resolve` | same | same |

## MCP

Reads: `get_member_eligibility`, `get_policy` (with `policyId`), `get_insurance_policy`, `get_coverage`, `get_claim_status`, `get_claim`, `get_pending_claims`, `get_denials`, `get_reconciliation_status`, `get_insurance_kpis`

Mutations: `create_claim`, `submit_claim`, `request_authorization`, `appeal_claim`, `resolve_reconciliation`

Deny-by-default in `mcp-tool-permissions.ts` + capability gates via BusinessContext.
