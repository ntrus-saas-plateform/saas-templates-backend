import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  assertAccountProductIntegrity,
  assertEnvironmentSlotRules,
  assertNotTechnicalActiveLabel,
  assertProvisioningRequestTransition,
  evaluateConditionalTenantReuse,
} from './provisioning-request.entity.js';
import {
  ProvisioningEnvironmentSlot,
  ProvisioningRequestStatus,
} from './provisioning.types.js';

describe('provisioning-request domain (P7.1)', () => {
  it('allows REQUESTED → ACCEPTED', () => {
    expect(() =>
      assertProvisioningRequestTransition(
        ProvisioningRequestStatus.REQUESTED,
        ProvisioningRequestStatus.ACCEPTED,
      ),
    ).not.toThrow();
  });

  it('forbids REJECTED → ACCEPTED', () => {
    expect(() =>
      assertProvisioningRequestTransition(
        ProvisioningRequestStatus.REJECTED,
        ProvisioningRequestStatus.ACCEPTED,
      ),
    ).toThrow(DomainError);
  });

  it('rejects technical ACTIVE label', () => {
    expect(() => assertNotTechnicalActiveLabel('ACTIVE')).toThrow(DomainError);
  });

  it('requires entitlement for non-PROD slots (OQ-03)', () => {
    expect(() =>
      assertEnvironmentSlotRules({
        slot: ProvisioningEnvironmentSlot.STAGING,
        slotEntitled: false,
      }),
    ).toThrow(DomainError);
    expect(() =>
      assertEnvironmentSlotRules({
        slot: ProvisioningEnvironmentSlot.PROD,
        slotEntitled: false,
      }),
    ).not.toThrow();
  });

  it('enforces account/product/subscription integrity', () => {
    expect(() =>
      assertAccountProductIntegrity({
        authAccountId: 'a',
        authProductId: 'p',
        authSubscriptionId: 's',
        requestAccountId: 'a2',
        requestProductId: 'p',
        requestSubscriptionId: 's',
      }),
    ).toThrow(DomainError);
  });

  it('never auto-reuses tenants (OQ-02)', () => {
    const denied = evaluateConditionalTenantReuse({
      proposedProductTenantId: 'tenant-1',
      sameAccount: true,
      sameProduct: true,
      lifecycleCompatible: true,
      legalHold: false,
      securityHold: false,
      explicitReuseApproved: false,
    });
    expect(denied.reuse).toBe(false);
    expect(denied.reasonCode).toBe('REUSE_NOT_EXPLICITLY_APPROVED');

    const ok = evaluateConditionalTenantReuse({
      proposedProductTenantId: 'tenant-1',
      sameAccount: true,
      sameProduct: true,
      lifecycleCompatible: true,
      legalHold: false,
      securityHold: false,
      explicitReuseApproved: true,
    });
    expect(ok.reuse).toBe(true);
  });
});
