import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_OPERATION_CAPABILITIES,
  matchRequiredCapabilities,
  operationRequiresCapability,
} from './capability-matching.js';
import { ProductControlErrorCode } from './product-control.types.js';

describe('capability matching', () => {
  it('matches when all required capabilities are declared', () => {
    const result = matchRequiredCapabilities({
      required: ['control.handshake', 'control.verify_health'],
      declared: ['control.handshake', 'control.verify_health', 'extra'],
    });
    expect(result.matched).toBe(true);
  });

  it('reports missing required capabilities', () => {
    const result = matchRequiredCapabilities({
      required: ['control.handshake', 'control.discover_contract'],
      declared: ['control.handshake'],
    });
    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.code).toBe(ProductControlErrorCode.CAPABILITY_UNSUPPORTED);
      expect(result.missing).toContain('control.discover_contract');
    }
  });

  it('flags unknown declared capabilities against catalog', () => {
    const result = matchRequiredCapabilities({
      required: ['control.handshake'],
      declared: ['control.handshake', 'weird.capability'],
      knownCatalog: Object.values(FOUNDATION_OPERATION_CAPABILITIES),
    });
    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.unknownDeclared).toContain('weird.capability');
    }
  });

  it('maps foundation operations to required capabilities', () => {
    expect(
      operationRequiresCapability(
        'product_control.handshake',
        FOUNDATION_OPERATION_CAPABILITIES,
      ),
    ).toBe('control.handshake');
  });
});
