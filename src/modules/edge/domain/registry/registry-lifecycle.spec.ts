import {
  assertMutableContract,
  assertMutableTechnicalVersion,
  assertProductRegistryTransition,
  isProvisionable,
} from './registry-lifecycle.js';
import {
  CertificationStatus,
  ControlContractStatus,
  RegistryLifecycleStatus,
  TechnicalVersionStatus,
} from './registry.types.js';

describe('registry lifecycle', () => {
  it('allows DRAFT → VALIDATING → CERTIFIED', () => {
    expect(() =>
      assertProductRegistryTransition(
        RegistryLifecycleStatus.DRAFT,
        RegistryLifecycleStatus.VALIDATING,
      ),
    ).not.toThrow();
    expect(() =>
      assertProductRegistryTransition(
        RegistryLifecycleStatus.VALIDATING,
        RegistryLifecycleStatus.CERTIFIED,
      ),
    ).not.toThrow();
    expect(
      isProvisionable(RegistryLifecycleStatus.CERTIFIED, CertificationStatus.CERTIFIED),
    ).toBe(true);
  });

  it('rejects uncertified product as provisionable', () => {
    expect(
      isProvisionable(RegistryLifecycleStatus.DRAFT, CertificationStatus.UNCERTIFIED),
    ).toBe(false);
  });

  it('requires reason for suspend', () => {
    expect(() =>
      assertProductRegistryTransition(
        RegistryLifecycleStatus.CERTIFIED,
        RegistryLifecycleStatus.SUSPENDED,
      ),
    ).toThrow();
  });

  it('blocks silent mutation of published technical versions', () => {
    expect(() =>
      assertMutableTechnicalVersion(TechnicalVersionStatus.PUBLISHED),
    ).toThrow();
  });

  it('blocks mutation of published contracts', () => {
    expect(() =>
      assertMutableContract(true, ControlContractStatus.PUBLISHED),
    ).toThrow();
  });
});
