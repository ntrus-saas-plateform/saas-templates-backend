# P7.9 — Security Review

## AuthZ matrix

| Permission | Capabilities |
|------------|--------------|
| `platform:experience:read` | List/get profiles, applications, assignments, domains |
| `platform:experience:manage` | Create/publish profiles and applications |
| `platform:experience:deploy` | Assign + provision + deactivate |
| `platform:experience:domains` | Bind domains (ownership challenge) |
| `platform:experience:history:read` | Runs + evidence |

Role seed (migration 104): `EDGE_PLATFORM_SUPER_ADMIN` receives all `platform:experience:*`; `EDGE_PLATFORM_OPERATOR` receives read + history:read only.

Controller auth coverage: `experience.controller.auth.spec.ts`.

## Fail-closed controls

- P7.1 revalidation on assign, provision, and deactivate (HTTP use cases).
- Live executor revalidates again before every handler mutation; missing/stale/timeout → deny.
- Mutative provision/deactivate only via P7.4 workflows (`p79.experience.*`).
- Handlers without a live executor fail (`PROVIDER_UNAVAILABLE`) — no simulated success.
- Secrets: vault refs only; redaction for events/evidence/API helpers.
- Durable audit required for experience mutations (outbox + audit ports).

## Hard boundary: no business IAM

P7.9 must not manage users, roles, memberships, or organizations. Client registration is **technical OIDC only**.

## Hard boundary: P5 does not expand

Experience assignment does **not** grant or expand commercial entitlements. Opaque `entitlementSnapshotVersion` on application versions is a label, not a grant engine.

## Threat notes

| Threat | Mitigation |
|--------|------------|
| Open redirect / wild CORS | Redirect URI + web origin validators |
| Domain takeover | Hostname rules, unique hostname, ownership tokens, verified-host redirect bind |
| Secret exfiltration | Vault-only `credential_ref` / `certificate_ref`; redaction |
| Privilege via stale auth | P7.1 fail-closed revalidation |
| Replay / duplicate provision | Idempotency keys |
| Stale worker mutation | P7.4 lease fencing when lease port wired |
| Unauthorized history read | Separate history permission |
| Fake success without infra | Fail-closed absent executor |

## Residual risks

- Remote push may fail with **HTTP 403** (repo permissions) — local commits only until fixed.
- TLS provision in the live executor is a **local registry apply** writing vault refs / certificate metadata — not a claim of external ACME/CDN certification.
- Formal ACCEPTED requires independent audit after green test evidence.
