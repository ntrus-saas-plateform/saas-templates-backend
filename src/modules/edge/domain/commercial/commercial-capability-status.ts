/**
 * RGOM-E0 — Frozen commercial capability statuses (gates / catalog).
 * Planned must never appear as Available in a Published offer.
 */

export const COMMERCIAL_CAPABILITY_STATUSES = [
  'AVAILABLE',
  'LIMITED',
  'CONTROLLED',
  'BETA',
  'PLANNED',
  'DEPRECATED',
] as const;

export type CommercialCapabilityStatus = (typeof COMMERCIAL_CAPABILITY_STATUSES)[number];

export function isCommercialCapabilityStatus(value: string): value is CommercialCapabilityStatus {
  return (COMMERCIAL_CAPABILITY_STATUSES as readonly string[]).includes(value);
}

/** Statuses that may be included in a Published commercial offer. */
export function isCommerciallyIncludable(status: CommercialCapabilityStatus): boolean {
  return status !== 'PLANNED' && status !== 'DEPRECATED';
}

export function assertCapabilityCommerciallyIncludable(
  status: CommercialCapabilityStatus,
  capabilityCode?: string,
): void {
  if (!isCommerciallyIncludable(status)) {
    const label = capabilityCode ? ` (${capabilityCode})` : '';
    throw new Error(
      `Capability${label} status ${status} is not commercially includable in Published offers`,
    );
  }
}
