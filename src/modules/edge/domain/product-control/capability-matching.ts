import { ProductControlErrorCode } from './product-control.types.js';

export type CapabilityMatchResult =
  | { matched: true; matchedCapabilities: string[] }
  | {
      matched: false;
      code: ProductControlErrorCode;
      missing: string[];
      unknownDeclared: string[];
    };

/**
 * Declared capabilities are not proof of successful execution —
 * matching only checks declaration overlap.
 */
export function matchRequiredCapabilities(input: {
  required: readonly string[];
  declared: readonly string[];
  knownCatalog?: readonly string[];
}): CapabilityMatchResult {
  const declaredSet = new Set(input.declared.map((c) => c.trim()).filter(Boolean));
  const required = input.required.map((c) => c.trim()).filter(Boolean);
  const missing = required.filter((r) => !declaredSet.has(r));

  const unknownDeclared: string[] = [];
  if (input.knownCatalog && input.knownCatalog.length > 0) {
    const known = new Set(input.knownCatalog);
    for (const d of declaredSet) {
      if (!known.has(d)) unknownDeclared.push(d);
    }
  }

  if (missing.length > 0 || unknownDeclared.length > 0) {
    return {
      matched: false,
      code: ProductControlErrorCode.CAPABILITY_UNSUPPORTED,
      missing,
      unknownDeclared,
    };
  }

  return { matched: true, matchedCapabilities: [...required] };
}

export function operationRequiresCapability(
  operationCode: string,
  capabilityMap: Readonly<Record<string, string>>,
): string | null {
  return capabilityMap[operationCode] ?? null;
}

/** Foundation read-only operations capability map. */
export const FOUNDATION_OPERATION_CAPABILITIES: Readonly<Record<string, string>> = {
  'product_control.handshake': 'control.handshake',
  'product_control.discover_contract': 'control.discover_contract',
  'product_control.discover_capabilities': 'control.discover_capabilities',
  'product_control.verify_connectivity': 'control.verify_connectivity',
  'product_control.verify_health': 'control.verify_health',
  'product_control.verify_conformance': 'control.verify_conformance',
};
