# P7.10 — Security Review

## AuthZ matrix

| Permission | Capabilities |
|------------|--------------|
| `platform:activation:read` | List/get evaluations and activation records |
| `platform:activation:evaluate` | Create evaluation; launch evaluate workflows |
| `platform:activation:activate` | Create activation record; launch activate workflow |
| `platform:activation:history:read` | Runs + evidence |

Role seed (migration 105): `EDGE_PLATFORM_SUPER_ADMIN` receives all `platform:activation:*`; `EDGE_PLATFORM_OPERATOR` receives read + history:read only.

Controller auth coverage: `activation.controller.auth.spec.ts`.

## Fail-closed controls

- P7.1 revalidation on create evaluation, create record, evaluate, and activate (HTTP use cases).
- Live executor revalidates again before every handler mutation; missing/stale/timeout → deny.
- Missing bound row/version → `TRUST_MATERIAL_MISSING` (O3: never best-effort activate without trust material).
- Mutative evaluate/activate only via P7.4 workflows (`p710.*`).
- Handlers without a live executor fail (`PROVIDER_UNAVAILABLE`) — no simulated success.
- Compensation never silently marks ACTIVE.
- Durable audit required for activation mutations (outbox + audit ports).

## Hard boundary: no commercial ACTIVE from this gate

- `activation.mark_active` updates **Activation Record** only.
- `activation.emit_provisioning_completed` sets `provisioningConfirmed` and emits `subscription.provisioning.completed.v1` — **does not** set commercial `Subscription.ACTIVE` alone.
- P6 payment activation is out of scope and must not drive technical ACTIVE.

## Hard boundary: distinct from P1 readiness

Technical console/API must not overload `/edge/readiness` (P1 commercial). Technical surface: `/edge/provisioning/readiness` + `/edge/activation/*`.

## Threat notes

| Threat | Mitigation |
|--------|------------|
| Activate without trust material | `TRUST_MATERIAL_MISSING` fail-closed (O3) |
| Privilege via stale auth | P7.1 revalidation on HTTP + every handler |
| Fake READY without prior phases | Required checks; missing ports → FAILED |
| Invent commercial ACTIVE | Subscription update limited to `provisioningConfirmed` |
| Silent compensate → ACTIVE | `WAITING_APPROVAL` compensation |
| Replay / duplicate activate | Idempotency keys |
| Stale worker mutation | P7.4 lease fencing when lease port wired |
| Unauthorized history read | Separate history permission |
| Fake success without infra | Fail-closed absent executor |

## Residual risks

- Remote push may fail with **HTTP 403** (repo permissions) — local commits only until fixed.
- Formal ACCEPTED requires independent audit after green test evidence is recorded.
- O3 production trust material may remain operationally open — gate stays fail-closed.
