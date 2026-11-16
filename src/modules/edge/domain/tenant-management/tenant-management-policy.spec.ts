import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertAdministrativeTransition,
  assertJustification,
  assertLegalHoldMutationRequiresWorkflow,
  assertNotLegalHold,
  assertP7BridgeOutcomeAllowsApproval,
  assertTenantInOperatorScope,
  assertSeparationOfDuties,
  canRequestLifecycle,
  coerceHealthOverallStatus,
  evaluateTenantRiskLevel,
  governanceStatusAfterExceptionRevoke,
  isDedicatedGovernanceApprovable,
  nextStatusAfterApproval,
  slugifyTenantCode,
  unavailableGovernanceCheck,
} from './tenant-management-policy.js';
import { GovernanceStatus, HealthStatus, LifecycleRequestType, RiskLevel } from './tenant-management.types.js';

describe('P8 tenant-management-policy', () => {
  it('allows ACTIVE → SUSPENDED', () => {
    expect(() => assertAdministrativeTransition('ACTIVE', 'SUSPENDED')).not.toThrow();
  });

  it('forbids ARCHIVED → ACTIVE', () => {
    expect(() => assertAdministrativeTransition('ARCHIVED', 'ACTIVE')).toThrow(DomainError);
  });

  it('blocks self-approval', () => {
    expect(() => assertSeparationOfDuties('user-a', 'user-a')).toThrow(
      expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
    );
  });

  it('blocks termination under legal hold', () => {
    expect(() => assertNotLegalHold(true, 'TERMINATE')).toThrow(
      expect.objectContaining({ code: ErrorCode.CONFLICT }),
    );
  });

  it('requires justification', () => {
    expect(() => assertJustification('short')).toThrow(
      expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
    );
    expect(() => assertJustification('long enough justification')).not.toThrow();
  });

  it('validates lifecycle request against admin status', () => {
    expect(canRequestLifecycle('TERMINATED', LifecycleRequestType.SUSPEND).ok).toBe(false);
    expect(canRequestLifecycle('SUSPENDED', LifecycleRequestType.RESUME).ok).toBe(true);
  });

  it('maps approval to next admin status', () => {
    expect(nextStatusAfterApproval(LifecycleRequestType.SUSPEND)).toBe('SUSPENDED');
    expect(nextStatusAfterApproval(LifecycleRequestType.MIGRATE)).toBeNull();
  });

  it('slugifies codes', () => {
    expect(slugifyTenantCode(' Acme Corp!! ')).toBe('acme-corp');
  });

  it('flags dedicated governance requests awaiting approval', () => {
    expect(isDedicatedGovernanceApprovable('REQUESTED')).toBe(true);
    expect(isDedicatedGovernanceApprovable('APPROVED')).toBe(false);
    expect(isDedicatedGovernanceApprovable('BLOCKED_LEGAL_HOLD')).toBe(false);
  });

  it('marks unavailable integrated checks honestly', () => {
    const check = unavailableGovernanceCheck('P6_BILLING');
    expect(check.availability).toBe('UNAVAILABLE');
    expect(check.integration).toBe('P6_BILLING');
  });

  it('coerces stale HEALTHY observations to STALE', () => {
    const old = new Date(Date.now() - 60 * 60 * 1000);
    expect(coerceHealthOverallStatus(HealthStatus.HEALTHY, old)).toBe(HealthStatus.STALE);
    expect(coerceHealthOverallStatus(HealthStatus.DEGRADED, old)).toBe(HealthStatus.DEGRADED);
  });

  it('elevates risk under legal hold and critical findings', () => {
    expect(
      evaluateTenantRiskLevel({
        legalHold: true,
        activeExceptionCount: 0,
        governanceStatus: GovernanceStatus.COMPLIANT,
        openCriticalFindings: 0,
      }).riskLevel,
    ).toBe(RiskLevel.HIGH);
    expect(
      evaluateTenantRiskLevel({
        legalHold: false,
        activeExceptionCount: 0,
        governanceStatus: GovernanceStatus.COMPLIANT,
        openCriticalFindings: 2,
      }).riskLevel,
    ).toBe(RiskLevel.CRITICAL);
  });

  it('requires workflow for legal hold RAISE and LIFT', () => {
    expect(() => assertLegalHoldMutationRequiresWorkflow(true, false)).toThrow();
    expect(() => assertLegalHoldMutationRequiresWorkflow(false, true)).toThrow();
    expect(() => assertLegalHoldMutationRequiresWorkflow(true, true)).not.toThrow();
    expect(() => assertLegalHoldMutationRequiresWorkflow(false, false)).not.toThrow();
  });

  it('fail-closes P7 bridge FAILED outcomes', () => {
    expect(() => assertP7BridgeOutcomeAllowsApproval('FAILED')).toThrow(
      expect.objectContaining({ code: ErrorCode.DEPENDENCY_UNAVAILABLE }),
    );
    expect(() => assertP7BridgeOutcomeAllowsApproval('STARTED')).not.toThrow();
  });

  it('enforces operator portfolio scope', () => {
    expect(() =>
      assertTenantInOperatorScope(
        {
          region: 'eu-west-1',
          accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          productId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          internalOwnerId: 'owner-1',
        },
        {
          global: false,
          regions: ['us-east-1'],
          accountIds: [],
          productIds: [],
          ownerIds: [],
        },
      ),
    ).toThrow(expect.objectContaining({ code: ErrorCode.FORBIDDEN }));
    expect(() =>
      assertTenantInOperatorScope(
        {
          region: 'eu-west-1',
          accountId: null,
          productId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          internalOwnerId: null,
        },
        {
          global: false,
          regions: ['eu-west-1'],
          accountIds: [],
          productIds: [],
          ownerIds: [],
        },
      ),
    ).not.toThrow();
  });

  it('restores governance after exception revoke', () => {
    expect(governanceStatusAfterExceptionRevoke(1, false)).toBe(GovernanceStatus.EXCEPTION_PENDING);
    expect(governanceStatusAfterExceptionRevoke(0, true)).toBe(GovernanceStatus.REVIEW_REQUIRED);
    expect(governanceStatusAfterExceptionRevoke(0, false)).toBe(GovernanceStatus.COMPLIANT);
  });
});
