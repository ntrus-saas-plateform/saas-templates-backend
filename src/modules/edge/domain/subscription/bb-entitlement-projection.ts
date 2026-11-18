/**
 * RGOM-E7 — project Edge resolved entitlements → Business Backend `/control/v1` payload.
 * Compatible with BB `parseEdgeProjectionPayload` / empty-entitlements guard.
 */

import {
  EntitlementCapabilityKind,
  type EntitlementSource,
  type ResolvedEntitlement,
  resolveEffectiveEntitlements,
} from './subscription.entity.js';
import { assessEntitlementPayload } from '../provisioning/entitlement-payload.guard.js';

export type BbControlGrant = {
  readonly code: string;
  readonly enabled: boolean;
};

export type BbControlEntitlementPayload = {
  readonly entitlements: {
    readonly modules: Record<string, boolean>;
    readonly capabilities: Record<string, boolean>;
    readonly quotas: Record<string, number>;
    readonly limits: Record<string, number>;
    readonly featureFlags: Record<string, boolean>;
  };
  readonly grants: readonly BbControlGrant[];
};

/** Module keys accepted by BB ModuleGuard (`^[a-z][a-z0-9_-]{0,62}$`). */
function looksLikeModuleKey(code: string): boolean {
  return /^[a-z][a-z0-9_-]{0,62}$/.test(code) && !code.includes('.');
}

/** Align with BB `edgeCodeToBbCapability` — modules also materialize UPPER_SNAKE caps. */
export function edgeCodeToBbCapability(code: string): string {
  return code
    .trim()
    .replace(/\./g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
}

function normalizeModuleKey(code: string): string | null {
  const trimmed = code.trim();
  // Dotted capability codes stay capabilities (e.g. pharmacy.batch) — never modules.
  if (trimmed.includes('.')) return null;
  const lowered = trimmed.toLowerCase();
  return looksLikeModuleKey(lowered) ? lowered : null;
}

export type SubscriptionItemLike = {
  readonly itemType: string;
  readonly offerRef?: string | null;
  readonly entitlementRef?: string | null;
  readonly snapshot: Record<string, unknown>;
};

export function collectEntitlementSourcesFromItems(
  items: readonly SubscriptionItemLike[],
  contractualExtensions?: readonly EntitlementSource[],
): EntitlementSource[] {
  const sources: EntitlementSource[] = [];
  for (const item of items) {
    const caps = (item.snapshot.capabilities as EntitlementSource[] | undefined) ?? [];
    for (const cap of caps) {
      sources.push({
        ...cap,
        sourceType:
          item.itemType === 'ADDON'
            ? 'ADDON'
            : item.itemType === 'PACKAGE'
              ? 'PACKAGE'
              : 'PLAN',
        sourceRef: item.offerRef,
      });
    }
    if (!caps.length && item.entitlementRef) {
      sources.push({
        sourceType: 'PLAN',
        sourceRef: item.entitlementRef,
        capabilityCode: item.entitlementRef,
        kind: EntitlementCapabilityKind.FEATURE_FLAG,
        enabled: true,
      });
    }
  }
  for (const ext of contractualExtensions ?? []) {
    sources.push({ ...ext, sourceType: 'CONTRACTUAL_EXTENSION' });
  }
  return sources;
}

export function projectResolvedEntitlementsToBbControl(
  resolved: readonly ResolvedEntitlement[],
): BbControlEntitlementPayload {
  const modules: Record<string, boolean> = {};
  const capabilities: Record<string, boolean> = {};
  const quotas: Record<string, number> = {};
  const limits: Record<string, number> = {};
  const featureFlags: Record<string, boolean> = {};
  const grants: BbControlGrant[] = [];

  for (const row of resolved) {
    const code = row.capabilityCode.trim();
    if (!code) continue;

    if (row.kind === EntitlementCapabilityKind.FEATURE_FLAG) {
      const moduleKey = normalizeModuleKey(code);
      if (moduleKey) {
        modules[moduleKey] = row.enabled;
        grants.push({ code: moduleKey, enabled: row.enabled });
        // Dual-write UPPER_SNAKE so BB @RequiresCapability('KITCHEN') matches module `kitchen`.
        const capCode = edgeCodeToBbCapability(moduleKey);
        capabilities[capCode] = row.enabled;
        if (row.enabled) grants.push({ code: capCode, enabled: true });
      } else {
        const capCode = code.includes('.') ? edgeCodeToBbCapability(code) : edgeCodeToBbCapability(code);
        capabilities[capCode] = row.enabled;
        featureFlags[code] = row.enabled;
        grants.push({ code: capCode, enabled: row.enabled });
      }
      continue;
    }

    if (
      row.kind === EntitlementCapabilityKind.QUOTA ||
      row.kind === EntitlementCapabilityKind.CAPACITY
    ) {
      if (row.numericLimit != null) {
        quotas[code] = row.numericLimit;
      }
      continue;
    }

    if (row.kind === EntitlementCapabilityKind.LIMIT) {
      if (row.numericLimit != null) {
        limits[code] = row.numericLimit;
      }
      continue;
    }

    // MUTUALLY_EXCLUSIVE treated as feature when enabled
    if (row.enabled) {
      capabilities[code] = true;
      grants.push({ code, enabled: true });
    }
  }

  return {
    entitlements: { modules, capabilities, quotas, limits, featureFlags },
    grants,
  };
}

export function buildBbEntitlementProjectionFromItems(input: {
  items: readonly SubscriptionItemLike[];
  contractualExtensions?: readonly EntitlementSource[];
}): {
  readonly resolved: readonly ResolvedEntitlement[];
  readonly projection: BbControlEntitlementPayload;
  readonly empty: boolean;
  readonly emptyReason: string | null;
} {
  const sources = collectEntitlementSourcesFromItems(
    input.items,
    input.contractualExtensions,
  );
  const resolved = resolveEffectiveEntitlements(sources);
  const projection = projectResolvedEntitlementsToBbControl(resolved);
  const emptiness = assessEntitlementPayload(projection.entitlements, projection.grants);
  return {
    resolved,
    projection,
    empty: emptiness.empty,
    emptyReason: emptiness.reason,
  };
}

/** Extract resolved list from a stored entitlement snapshot document. */
export function resolvedFromSnapshotEntitlements(
  entitlementsDoc: Record<string, unknown> | null | undefined,
): readonly ResolvedEntitlement[] {
  if (!entitlementsDoc || typeof entitlementsDoc !== 'object') return [];
  const resolved = entitlementsDoc.resolved;
  if (!Array.isArray(resolved)) return [];
  return resolved as ResolvedEntitlement[];
}
