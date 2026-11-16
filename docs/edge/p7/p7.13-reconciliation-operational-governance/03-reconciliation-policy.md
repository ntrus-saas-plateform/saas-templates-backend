# P7.13 — Reconciliation Policy

## Classification rules

1. If `metadata.providerUnreachable === true` (or observe timeout) ⇒ all desired resources classified **`UNKNOWN`** — never `MISSING`.
2. Reachable + desired absent ⇒ `MISSING`.
3. Reachable + both present + state differ ⇒ `DRIFT` (or `CONFLICT` if flagged).
4. Reachable + observed without desired ⇒ `UNEXPECTED` (auto-remediate denied — no blind deletes).

## Auto-remediate gate

Allowed **only if all** are true:

- `finding.autoRemediateEligible`
- `policy.autoRemediate`
- `remediation.reversible`
- `policy.requireApproval === false`
- observation class ∉ {`UNKNOWN`, `UNEXPECTED`}

Otherwise ⇒ `WAITING_APPROVAL` / `UNSAFE_AUTO_REMEDIATE` / `APPROVAL_REQUIRED`.

## Waivers

- Status `ACTIVE` **and** `expiresAt > now` required.
- Expired waivers are **invalid** even if status still ACTIVE.
- Applied before remediation planning; expired ignored.

## Quarantine

Use for uncertain / `UNKNOWN` findings — never invent deletion.
