# P7.15 — Architecture

## Purpose

P7.15 is the **production certification & evidence pack** gate for Shared SaaS. It owns certification packages, evidence item slots, gate evaluation, certify/revoke runs, and durable evidence. Mutative assemble / certify / revoke execute **only** via P7.4.

## Boundaries

| In scope | Out of scope |
|----------|--------------|
| Package + evidence items + runs + evidence | Claiming Modes A–C / real BB without recorded evidence |
| Assemble / certify / revoke via P7.4 (`p715.certification.*`) | Certifying with required evidence MISSING/FAILED |
| Default required keys P7.1–P7.13 (agents optional) | Treating P7.14 agents as required for Shared SaaS |
| Revoke clears CERTIFIED | Bypassing P7.1 when `provisioningRequestId` bound |

## Layering

```
Edge Console (/edge/provisioning/certification + /evidence) / API client
  → EdgeCertificationController (RBAC platform:certification:*)
  → Use cases (create/attach/assemble/certify/revoke/list)
    → CertificationRepositoryPort (Postgres, migration 111)
    → P7.4 workflow engine (definitions p715.certification.*)
      → LiveCertificationExecutor (handlers certification.*)
    → P7.1 authorization revalidation (fail-closed when provisioningRequestId bound)
```

## Hard dependencies

- **P7.1** — fail-closed when `provisioningRequestId` bound.
- **P7.4** — mutative ops only via durable workflows; **11th** live executor (`CERTIFICATION_LIVE_EXECUTOR`).
- **Migration 111** — `111_edge_p7_production_certification.sql` (110 = P7.14 agents; 108 = P8).
