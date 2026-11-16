import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertNoSelfDependency,
  assertObservationTransition,
  assertServiceCode,
  slugifyServiceCode,
} from './service-catalog-policy.js';
import { ServiceObservationStatus } from './service-catalog.types.js';

describe('P9 service-catalog-policy', () => {
  it('slugifies service codes', () => {
    expect(slugifyServiceCode(' Edge Control API ')).toBe('edge-control-api');
  });

  it('validates service codes', () => {
    expect(() => assertServiceCode('ok')).not.toThrow();
    expect(() => assertServiceCode('x')).toThrow(DomainError);
  });

  it('requires verificationSource for VERIFIED observation', () => {
    expect(() =>
      assertObservationTransition(
        ServiceObservationStatus.CONFIGURED,
        ServiceObservationStatus.VERIFIED,
        {},
      ),
    ).toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
    expect(() =>
      assertObservationTransition(
        ServiceObservationStatus.CONFIGURED,
        ServiceObservationStatus.VERIFIED,
        { verificationSource: 'probe.http' },
      ),
    ).not.toThrow();
  });

  it('forbids self-dependencies', () => {
    expect(() => assertNoSelfDependency('a', 'a')).toThrow(
      expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
    );
  });
});
