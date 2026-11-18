/**
 * RGOM-E7.1 / ADR-021 — entitlements commerciaux ne doivent pas être poussés vides
 * hors chemin lab explicite.
 */

export type EntitlementPayloadEmptiness = {
  readonly empty: boolean;
  readonly reason: string | null;
};

/**
 * Considère un payload vide s'il n'y a ni modules, ni capabilities, ni grants, ni quotas/limits utiles.
 */
export function assessEntitlementPayload(
  entitlements: Record<string, unknown> | null | undefined,
  grants?: unknown,
): EntitlementPayloadEmptiness {
  if (Array.isArray(grants) && grants.length > 0) {
    return { empty: false, reason: null };
  }

  if (!entitlements || typeof entitlements !== 'object') {
    return { empty: true, reason: 'entitlements_missing' };
  }

  const keys = Object.keys(entitlements);
  if (keys.length === 0) {
    return { empty: true, reason: 'entitlements_object_empty' };
  }

  const modules = entitlements.modules;
  if (modules && typeof modules === 'object' && Object.keys(modules as object).length > 0) {
    return { empty: false, reason: null };
  }

  const capabilities = entitlements.capabilities;
  if (
    capabilities &&
    typeof capabilities === 'object' &&
    Object.keys(capabilities as object).length > 0
  ) {
    return { empty: false, reason: null };
  }

  const featureFlags = entitlements.featureFlags ?? entitlements.feature_flags;
  if (
    featureFlags &&
    typeof featureFlags === 'object' &&
    Object.keys(featureFlags as object).length > 0
  ) {
    return { empty: false, reason: null };
  }

  const quotas = entitlements.quotas;
  if (quotas && typeof quotas === 'object' && Object.keys(quotas as object).length > 0) {
    return { empty: false, reason: null };
  }

  const limits = entitlements.limits;
  if (limits && typeof limits === 'object' && Object.keys(limits as object).length > 0) {
    return { empty: false, reason: null };
  }

  if (Array.isArray(grants) && grants.length > 0) {
    return { empty: false, reason: null };
  }

  const nestedGrants = entitlements.grants;
  if (Array.isArray(nestedGrants) && nestedGrants.length > 0) {
    return { empty: false, reason: null };
  }

  // Clés présentes mais sans contenu commercial exploitable
  return { empty: true, reason: 'entitlements_no_commercial_content' };
}

export function isLabProvisioningAdapter(
  adapter: string | undefined,
): adapter is 'lab_bb' {
  return adapter === 'lab_bb';
}

/** Prod ne doit jamais sélectionner lab_bb (chemin entitlements vides historiques). */
export function assertProvisioningAdapterAllowedInEnv(input: {
  nodeEnv: string;
  adapter: string;
}): void {
  if (input.nodeEnv === 'production' && input.adapter === 'lab_bb') {
    throw new Error(
      'EDGE_P7_PROVISIONING_ADAPTER=lab_bb is forbidden in production (RGOM-E7.1 / ADR-021). Use durable + non-empty entitlements.',
    );
  }
}
