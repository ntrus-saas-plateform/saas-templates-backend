# P7.3 — Security & RBAC

## Permissions (migration 098)

| Code | SUPER_ADMIN | OPERATOR |
|------|-------------|----------|
| `platform:placement:read` | ✓ | ✓ |
| `platform:placement:request` | ✓ | ✓ |
| `platform:placement:evaluate` | ✓ | ✓ |
| `platform:placement:confirm` | ✓ | ✓ |
| `platform:placement:cancel` | ✓ | ✓ |
| `platform:capacity:read` | ✓ | ✓ |
| `platform:capacity:manage` | ✓ | ✓ |
| `platform:capacity:reserve` | ✓ | ✓ |
| `platform:capacity:release` | ✓ | ✓ |
| `platform:placement_policy:read` | ✓ | ✓ |
| `platform:placement_policy:manage` | ✓ | (read only for OPERATOR) |

## Fail-closed commercial identity

`CreatePlacementRequestUseCase` validates eligibility via `PlacementAuthorizationViewPort`:

- Provisioning request status = `ACCEPTED`
- Authorization `decision=ALLOW`, `verificationStatus=VERIFIED`, `revocationStatus=NOT_REVOKED`
- Not expired / not before

Account, product, subscription, authorization ids are **copied from the auth view**, never trusted from the frontend body.

## Authz tests

`placement.controller.auth.spec.ts` asserts `@RequireEdgePermissions` metadata and guard deny/allow for capacity manage/release.
