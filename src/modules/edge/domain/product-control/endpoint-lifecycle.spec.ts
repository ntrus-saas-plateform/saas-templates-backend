import { describe, expect, it } from 'vitest';
import {
  assertEndpointAllowsDispatch,
  assertEndpointTransition,
  canTransitionEndpoint,
  isEndpointOperational,
} from './endpoint-lifecycle.js';
import { ProductControlEndpointStatus } from './product-control.types.js';

describe('endpoint lifecycle', () => {
  it('allows PENDING_VALIDATION → VALIDATING → ACTIVE', () => {
    expect(
      canTransitionEndpoint(
        ProductControlEndpointStatus.PENDING_VALIDATION,
        ProductControlEndpointStatus.VALIDATING,
      ),
    ).toBe(true);
    expect(
      canTransitionEndpoint(
        ProductControlEndpointStatus.VALIDATING,
        ProductControlEndpointStatus.ACTIVE,
      ),
    ).toBe(true);
  });

  it('allows ACTIVE ⇄ DEGRADED ⇄ UNAVAILABLE', () => {
    expect(
      canTransitionEndpoint(
        ProductControlEndpointStatus.ACTIVE,
        ProductControlEndpointStatus.DEGRADED,
      ),
    ).toBe(true);
    expect(
      canTransitionEndpoint(
        ProductControlEndpointStatus.DEGRADED,
        ProductControlEndpointStatus.UNAVAILABLE,
      ),
    ).toBe(true);
    expect(
      canTransitionEndpoint(
        ProductControlEndpointStatus.UNAVAILABLE,
        ProductControlEndpointStatus.ACTIVE,
      ),
    ).toBe(true);
  });

  it('requires reason for quarantine and revoke', () => {
    expect(() =>
      assertEndpointTransition(
        ProductControlEndpointStatus.ACTIVE,
        ProductControlEndpointStatus.QUARANTINED,
      ),
    ).toThrow();
    expect(() =>
      assertEndpointTransition(
        ProductControlEndpointStatus.ACTIVE,
        ProductControlEndpointStatus.QUARANTINED,
        'tls failure',
      ),
    ).not.toThrow();
  });

  it('blocks transitions from REVOKED', () => {
    expect(
      canTransitionEndpoint(
        ProductControlEndpointStatus.REVOKED,
        ProductControlEndpointStatus.ACTIVE,
      ),
    ).toBe(false);
  });

  it('forbids dispatch when QUARANTINED or REVOKED', () => {
    expect(() =>
      assertEndpointAllowsDispatch(ProductControlEndpointStatus.QUARANTINED),
    ).toThrow();
    expect(() =>
      assertEndpointAllowsDispatch(ProductControlEndpointStatus.REVOKED),
    ).toThrow();
    expect(() =>
      assertEndpointAllowsDispatch(ProductControlEndpointStatus.ACTIVE),
    ).not.toThrow();
  });

  it('marks ACTIVE and DEGRADED as operational', () => {
    expect(isEndpointOperational(ProductControlEndpointStatus.ACTIVE)).toBe(true);
    expect(isEndpointOperational(ProductControlEndpointStatus.DEGRADED)).toBe(true);
    expect(isEndpointOperational(ProductControlEndpointStatus.UNAVAILABLE)).toBe(false);
  });
});
