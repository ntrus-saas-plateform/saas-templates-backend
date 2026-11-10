import { describe, expect, it } from 'vitest';
import { assessCompensationSafety } from './compensation-safety.js';
import { ResourceStatus } from './infrastructure.types.js';

describe('compensation-safety', () => {
  it('blocks when deletion protection is on', () => {
    const a = assessCompensationSafety({
      resource: {
        status: ResourceStatus.FAILED,
        deletionProtection: true,
        driftStatus: 'NONE' as never,
        evidence: {},
      },
      deprovisionAuthorized: true,
    });
    expect(a.safe).toBe(false);
    expect(a.requireIntervention).toBe(true);
  });

  it('blocks UNKNOWN outcome', () => {
    const a = assessCompensationSafety({
      resource: {
        status: ResourceStatus.UNKNOWN,
        deletionProtection: false,
        driftStatus: 'NONE' as never,
        evidence: {},
      },
      deprovisionAuthorized: true,
    });
    expect(a.safe).toBe(false);
  });

  it('blocks when data may exist', () => {
    const a = assessCompensationSafety({
      resource: {
        status: ResourceStatus.READY,
        deletionProtection: false,
        driftStatus: 'NONE' as never,
        evidence: {},
      },
      database: {
        status: ResourceStatus.READY,
        isolationVerified: true,
        connectivityVerified: true,
        evidence: {},
      },
      deprovisionAuthorized: true,
    });
    expect(a.safe).toBe(false);
  });

  it('allows safe compensation for never-connected failed resource', () => {
    const a = assessCompensationSafety({
      resource: {
        status: ResourceStatus.FAILED,
        deletionProtection: false,
        driftStatus: 'NONE' as never,
        evidence: {},
      },
      database: {
        status: ResourceStatus.FAILED,
        isolationVerified: false,
        connectivityVerified: false,
        evidence: {},
      },
      deprovisionAuthorized: true,
      referencedByActiveResources: false,
      unresolvedReconciliation: false,
    });
    expect(a.safe).toBe(true);
  });
});
