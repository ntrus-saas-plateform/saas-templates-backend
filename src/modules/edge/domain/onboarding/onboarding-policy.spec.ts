import { describe, expect, it } from 'vitest';
import {
  assertJourneyTransition,
  canDecideTask,
  canRequestAdvance,
  canRequestClose,
  canRequestStart,
  pickNextAdvanceableStep,
} from './onboarding-policy.js';
import {
  OnboardingErrorCode,
  OnboardingJourneyStatus,
  OnboardingStepKind,
  OnboardingStepStatus,
  OnboardingTaskStatus,
  type OnboardingStepRecord,
} from './onboarding.types.js';

describe('canRequestStart', () => {
  it('allows PENDING → STARTING', () => {
    expect(canRequestStart(OnboardingJourneyStatus.PENDING)).toEqual({ allowed: true });
  });

  it('rejects non-PENDING', () => {
    const d = canRequestStart(OnboardingJourneyStatus.IN_PROGRESS);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(OnboardingErrorCode.JOURNEY_FORBIDDEN);
  });
});

describe('canRequestAdvance', () => {
  it('allows IN_PROGRESS', () => {
    expect(canRequestAdvance(OnboardingJourneyStatus.IN_PROGRESS)).toEqual({ allowed: true });
  });

  it('rejects WAITING_APPROVAL', () => {
    const d = canRequestAdvance(OnboardingJourneyStatus.WAITING_APPROVAL);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(OnboardingErrorCode.JOURNEY_FORBIDDEN);
  });
});

describe('canRequestClose', () => {
  it('allows when all required steps PASSED', () => {
    const d = canRequestClose({
      journeyStatus: OnboardingJourneyStatus.IN_PROGRESS,
      steps: [
        { required: true, stepStatus: OnboardingStepStatus.PASSED, stepKey: 'a' },
        { required: false, stepStatus: OnboardingStepStatus.PENDING, stepKey: 'b' },
      ],
    });
    expect(d).toEqual({ allowed: true });
  });

  it('rejects when a required step is not PASSED', () => {
    const d = canRequestClose({
      journeyStatus: OnboardingJourneyStatus.IN_PROGRESS,
      steps: [
        { required: true, stepStatus: OnboardingStepStatus.PASSED, stepKey: 'a' },
        { required: true, stepStatus: OnboardingStepStatus.READY, stepKey: 'ops' },
      ],
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(OnboardingErrorCode.STEP_NOT_READY);
  });
});

describe('canDecideTask', () => {
  const base = {
    taskStatus: OnboardingTaskStatus.OPEN,
    journeyStatus: OnboardingJourneyStatus.WAITING_APPROVAL,
    authorizationRevalidated: true,
    decision: 'APPROVE' as const,
  };

  it('allows when OPEN + WAITING_APPROVAL + P7.1 revalidated', () => {
    expect(canDecideTask(base)).toEqual({ allowed: true });
  });

  it('blocks human approval when auth not revalidated (cannot bypass)', () => {
    const d = canDecideTask({ ...base, authorizationRevalidated: false });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.code).toBe(OnboardingErrorCode.HUMAN_APPROVAL_CANNOT_BYPASS_AUTH);
    }
  });

  it('rejects non-OPEN tasks', () => {
    const d = canDecideTask({ ...base, taskStatus: OnboardingTaskStatus.APPROVED });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(OnboardingErrorCode.CONFLICT);
  });
});

describe('assertJourneyTransition', () => {
  it('allows PENDING → STARTING and IN_PROGRESS → WAITING_APPROVAL', () => {
    expect(
      assertJourneyTransition(
        OnboardingJourneyStatus.PENDING,
        OnboardingJourneyStatus.STARTING,
      ).allowed,
    ).toBe(true);
    expect(
      assertJourneyTransition(
        OnboardingJourneyStatus.IN_PROGRESS,
        OnboardingJourneyStatus.WAITING_APPROVAL,
      ).allowed,
    ).toBe(true);
  });

  it('rejects PENDING → CLOSED (must pass CLOSING)', () => {
    const d = assertJourneyTransition(
      OnboardingJourneyStatus.PENDING,
      OnboardingJourneyStatus.CLOSED,
    );
    expect(d.allowed).toBe(false);
  });
});

describe('pickNextAdvanceableStep', () => {
  it('picks first required READY/PENDING by order', () => {
    const steps: OnboardingStepRecord[] = [
      {
        id: '1',
        journeyId: 'j',
        tenantId: 't',
        stepKey: 'a',
        stepOrder: 1,
        stepKind: OnboardingStepKind.VERIFY,
        stepStatus: OnboardingStepStatus.PASSED,
        required: true,
        dependsOn: [],
        message: null,
        evidenceRef: null,
        details: {},
        startedAt: null,
        finishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        journeyId: 'j',
        tenantId: 't',
        stepKey: 'ops',
        stepOrder: 2,
        stepKind: OnboardingStepKind.HUMAN,
        stepStatus: OnboardingStepStatus.READY,
        required: true,
        dependsOn: ['a'],
        message: null,
        evidenceRef: null,
        details: {},
        startedAt: null,
        finishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    expect(pickNextAdvanceableStep(steps)?.stepKey).toBe('ops');
  });
});
