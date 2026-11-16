# P7.9 — Architecture

## Purpose

P7.9 provisions a **tenant product experience**: published experience profiles and applications, technical OIDC client registrations, domain/TLS bindings, and deployment evidence. It does **not** manage business IAM (no users, roles, memberships, or organizations) and does **not** expand commercial entitlements (P5 remains the grant authority; assignment here does not grant entitlements).

## Boundaries

| In scope | Out of scope |
|----------|--------------|
| Experience profiles + applications / versions | Business IAM users / roles / memberships / orgs |
| Tenant experience assignments | Expanding P5 entitlements via assignment |
| Technical OIDC clients (`credential_ref` only) | Plaintext client secrets in manifests or evidence |
| Domain bind + ownership tokens + TLS refs | Free-form DNS registrar automation beyond local apply |
| Provision / deactivate via P7.4 workflows | Silent HTTP-only side effects for mutative provision |
| Runs + evidence + history | Product catalog / commercial pricing |

## Layering

```
Edge Console / API client
  → EdgeExperienceController (RBAC)
    → Use cases (registry + assign / provision / deactivate / bind domain)
      → ExperienceRepositoryPort (Postgres, migration 104)
      → P7.4 workflow engine (definitions p79.experience.*)
        → LiveExperienceExecutor (handlers)
          → local registry apply (bindings, clients, domains, TLS refs)
      → P7.1 authorization revalidation (fail-closed)
```

## Hard dependencies

- **P7.1** — bound authorization must revalidate before assign / provision / deactivate (fail-closed).
- **P7.4** — mutative provision and deactivate launch durable workflows; handlers require a live executor (no simulated success).
- **P5** — this package does not expand entitlements; experience assignment is not an entitlement grant.

## Workflow definitions

| Code | Intent |
|------|--------|
| `p79.experience.provision` | validate_plan → bind_applications → register_clients → bind_domains → provision_tls → verify_experience |
| `p79.experience.deactivate` | deactivate (clients, domains, bindings, assignment) |

Compensation on provision failure routes through `experience.deactivate` (wired on the verify step; non-deactivate handlers suspend compensation pending safety assessment).

## Secrets

Manifests and client registrations may only carry vault references (`sec_*` / `vault:`). `credential_ref` and `certificate_ref` are opaque handles. Redaction helpers strip secret-shaped fields from API/audit/evidence while preserving vault refs.

## Related audit

Prior-phase readiness: `docs/edge/p7/p7-completion/00-prior-phases-integration-audit.md`.
