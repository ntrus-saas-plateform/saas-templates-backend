import { describe, expect, it } from 'vitest';
import {
  assertReadyRequiresVerification,
  assertResourceTransition,
} from './resource-state-machine.js';
import { ResourceStatus } from './infrastructure.types.js';

describe('resource-state-machine', () => {
  it('allows provisioning path', () => {
    expect(() =>
      assertResourceTransition(ResourceStatus.PLANNED, ResourceStatus.RESERVED),
    ).not.toThrow();
    expect(() =>
      assertResourceTransition(ResourceStatus.RESERVED, ResourceStatus.PROVISIONING),
    ).not.toThrow();
    expect(() =>
      assertResourceTransition(ResourceStatus.PROVISIONING, ResourceStatus.VERIFYING),
    ).not.toThrow();
  });

  it('forbids PLANNED → READY', () => {
    expect(() =>
      assertResourceTransition(ResourceStatus.PLANNED, ResourceStatus.READY),
    ).toThrow();
  });

  it('READY requires verification evidence', () => {
    expect(() =>
      assertReadyRequiresVerification({
        from: ResourceStatus.VERIFYING,
        to: ResourceStatus.READY,
        connectivityVerified: true,
        isolationVerified: true,
      }),
    ).not.toThrow();
    expect(() =>
      assertReadyRequiresVerification({
        from: ResourceStatus.VERIFYING,
        to: ResourceStatus.READY,
        connectivityVerified: false,
        isolationVerified: true,
      }),
    ).toThrow();
  });
});
