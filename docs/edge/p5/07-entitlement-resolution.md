# P5 — Entitlement Resolution

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**

## Purpose

Produce a **deterministic** entitlement payload for a subscription period from commercial composition. Output is stored as an **immutable snapshot** (`edge_entitlement_snapshots`). This is **not** runtime tenant ACL enforcement.

## Inputs (ordered)

| Layer | Source |
|-------|--------|
| 1. Plan | Subscription item — base capabilities from P2 plan inclusions (snapshotted) |
| 2. Package | Package inclusions (snapshotted) |
| 3. Add-ons | Attached add-on inclusions (snapshotted) |
| 4. Contractual extensions | Enterprise / contract overlay on subscription (explicit fields only) |

P2 **capability inclusions** define catalog-time inclusion; P5 does not re-query live P2 for published snapshots.

## Resolution steps

1. Collect capability records from snapshotted inclusion ids (plan ? package ? add-ons).
2. Apply contractual extensions (only keys declared in enterprise overlay schema).
3. Merge per capability **kind** using conflict policy below.
4. Stamp `resolved_at`, `subscription_id`, `period_id`, `snapshot_version`.
5. Persist snapshot; publish via `edge_entitlement_publications`.

## Conflict policy

| Capability kind | Merge rule | Notes |
|-----------------|------------|-------|
| Additive capacity / quota (numeric) | **MAX** across sources | Higher included limit wins |
| Explicit extension ceiling on contract | **Overrides MAX** | Contract ceiling is an explicit cap — not silent bump |
| Boolean feature flags | **BOOLEAN OR** | Any source enabling `true` yields enabled |
| Mutually exclusive features | **REJECT** | Domain error — operator must fix composition |
| Unknown / untyped | **REJECT** | No silent default |

## Historical integrity

| Rule | |
|------|---|
| Never silently overwrite | Published snapshots are never `UPDATE`d |
| Catalog drift | New P2 publication does not alter past snapshots |
| Re-publish | New snapshot version + supersede pointer only |
| Reconcile | `reconcile_entitlements` compares read models to latest published snapshot — fixes projections, not history |

## Events

| Event | When |
|-------|------|
| `entitlement.snapshot.created.v1` | New immutable snapshot persisted |
| `entitlement.published.v1` | Publication pointer moved to snapshot |
| `entitlement.reconciled.v1` | Read model reconcile completed (optional) |
