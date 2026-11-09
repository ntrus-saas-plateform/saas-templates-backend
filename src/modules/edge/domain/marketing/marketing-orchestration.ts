import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ConsentState, DataQuality, assertConsentAllowsChannel } from './marketing.entity.js';

export enum DeliveryStatus {
  REQUESTED = 'REQUESTED',
  QUEUED = 'QUEUED',
  SUBMITTED = 'SUBMITTED',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  BOUNCED = 'BOUNCED',
  SUPPRESSED = 'SUPPRESSED',
  CANCELLED = 'CANCELLED',
}

export enum JourneyExecutionStatus {
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
  STOPPED = 'STOPPED',
  FAILED = 'FAILED',
  EXITED_CONVERSION = 'EXITED_CONVERSION',
  EXITED_UNSUBSCRIBE = 'EXITED_UNSUBSCRIBE',
}

export type JourneyStepDefinition = {
  readonly key: string;
  readonly type: 'SEND_MESSAGE' | 'UPDATE_STATUS' | 'SCORE_LEAD' | 'WAIT' | 'STOP' | 'BRANCH';
  readonly channel?: string;
  readonly purpose?: string;
  readonly templateCode?: string;
  readonly toStatus?: string;
  readonly waitHours?: number;
  readonly next?: string | null;
  readonly onTrue?: string | null;
  readonly onFalse?: string | null;
  readonly condition?: 'HAS_CONSENT' | 'ALWAYS';
};

export type JourneyDefinition = {
  readonly steps: readonly JourneyStepDefinition[];
  readonly entryStepKey: string;
};

/** Never mark DELIVERED without a verified provider receipt. */
export function assertDeliveryTransition(
  from: DeliveryStatus | string,
  to: DeliveryStatus | string,
  opts?: { hasVerifiedReceipt?: boolean },
): void {
  const allowed: Record<string, string[]> = {
    [DeliveryStatus.REQUESTED]: [
      DeliveryStatus.QUEUED,
      DeliveryStatus.SUBMITTED,
      DeliveryStatus.SUPPRESSED,
      DeliveryStatus.CANCELLED,
      DeliveryStatus.FAILED,
    ],
    [DeliveryStatus.QUEUED]: [
      DeliveryStatus.SUBMITTED,
      DeliveryStatus.FAILED,
      DeliveryStatus.SUPPRESSED,
      DeliveryStatus.CANCELLED,
    ],
    [DeliveryStatus.SUBMITTED]: [
      DeliveryStatus.DELIVERED,
      DeliveryStatus.FAILED,
      DeliveryStatus.BOUNCED,
    ],
    [DeliveryStatus.DELIVERED]: [],
    [DeliveryStatus.FAILED]: [],
    [DeliveryStatus.BOUNCED]: [],
    [DeliveryStatus.SUPPRESSED]: [],
    [DeliveryStatus.CANCELLED]: [],
  };
  const nextAllowed = allowed[from] ?? [];
  if (!nextAllowed.includes(to)) {
    throw new DomainError(ErrorCode.CONFLICT, `Illegal delivery transition ${from} → ${to}`, [
      { from, to },
    ]);
  }
  if (to === DeliveryStatus.DELIVERED && !opts?.hasVerifiedReceipt) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Cannot mark delivery DELIVERED without a verified provider receipt',
      [{ from, to }],
    );
  }
}

export function assertChannelActiveForSend(status: string): void {
  if (status !== 'ACTIVE') {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Channel is not ACTIVE — cannot request delivery',
      [{ status }],
    );
  }
}

export function evaluateJourneyGate(input: {
  suppressed: boolean;
  consents: readonly { purpose: string; channel: string; state: string }[];
  purpose: string;
  channel: string;
}): 'CONTINUE' | 'EXIT_UNSUBSCRIBE' | 'SUPPRESS' {
  if (input.suppressed) return 'SUPPRESS';
  try {
    assertConsentAllowsChannel({
      consents: input.consents.map((c) => ({
        purpose: c.purpose,
        channel: c.channel,
        state: c.state as ConsentState,
      })),
      purpose: input.purpose,
      channel: input.channel,
    });
    return 'CONTINUE';
  } catch {
    return 'EXIT_UNSUBSCRIBE';
  }
}

export type AttributionTouch = {
  readonly id: string;
  readonly campaignId: string | null;
  readonly channel: string | null;
  readonly occurredAt: Date;
};

export type AttributionCredit = {
  readonly touchpointId: string;
  readonly campaignId: string | null;
  readonly channel: string | null;
  readonly credit: number;
};

/** Deterministic attribution — never invents missing touches. */
export function calculateAttributionCredits(input: {
  modelType: string;
  touches: readonly AttributionTouch[];
}): {
  credits: AttributionCredit[];
  dataQuality: DataQuality;
} {
  if (input.touches.length === 0) {
    return { credits: [], dataQuality: DataQuality.UNAVAILABLE };
  }
  const sorted = [...input.touches].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  if (input.modelType === 'FIRST_TOUCH') {
    const t = sorted[0];
    return {
      credits: [
        {
          touchpointId: t.id,
          campaignId: t.campaignId,
          channel: t.channel,
          credit: 1,
        },
      ],
      dataQuality: DataQuality.MEASURED,
    };
  }

  if (input.modelType === 'LAST_TOUCH') {
    const t = sorted[sorted.length - 1];
    return {
      credits: [
        {
          touchpointId: t.id,
          campaignId: t.campaignId,
          channel: t.channel,
          credit: 1,
        },
      ],
      dataQuality: DataQuality.MEASURED,
    };
  }

  if (input.modelType === 'LINEAR') {
    const share = 1 / sorted.length;
    return {
      credits: sorted.map((t) => ({
        touchpointId: t.id,
        campaignId: t.campaignId,
        channel: t.channel,
        credit: Math.round(share * 1e6) / 1e6,
      })),
      dataQuality: DataQuality.MEASURED,
    };
  }

  if (input.modelType === 'POSITION_BASED') {
    if (sorted.length === 1) {
      const t = sorted[0];
      return {
        credits: [
          {
            touchpointId: t.id,
            campaignId: t.campaignId,
            channel: t.channel,
            credit: 1,
          },
        ],
        dataQuality: DataQuality.MEASURED,
      };
    }
    if (sorted.length === 2) {
      return {
        credits: sorted.map((t) => ({
          touchpointId: t.id,
          campaignId: t.campaignId,
          channel: t.channel,
          credit: 0.5,
        })),
        dataQuality: DataQuality.MEASURED,
      };
    }
    const middleShare = 0.2 / (sorted.length - 2);
    return {
      credits: sorted.map((t, i) => {
        let credit = middleShare;
        if (i === 0 || i === sorted.length - 1) credit = 0.4;
        return {
          touchpointId: t.id,
          campaignId: t.campaignId,
          channel: t.channel,
          credit: Math.round(credit * 1e6) / 1e6,
        };
      }),
      dataQuality: DataQuality.MEASURED,
    };
  }

  throw new DomainError(ErrorCode.VALIDATION_ERROR, `Unsupported attribution model ${input.modelType}`, [
    { modelType: input.modelType },
  ]);
}

export function resolveNextJourneyStep(
  definition: JourneyDefinition,
  currentKey: string | null,
  branchTrue?: boolean,
): JourneyStepDefinition | null {
  const steps = new Map(definition.steps.map((s) => [s.key, s]));
  if (!currentKey) {
    return steps.get(definition.entryStepKey) ?? null;
  }
  const current = steps.get(currentKey);
  if (!current) return null;
  if (current.type === 'BRANCH') {
    const nextKey = branchTrue ? current.onTrue : current.onFalse;
    return nextKey ? steps.get(nextKey) ?? null : null;
  }
  if (current.type === 'STOP') return null;
  return current.next ? steps.get(current.next) ?? null : null;
}

export type FrequencyPolicy = {
  readonly channel: string;
  readonly maxPerDay: number;
  readonly maxPerWeek: number;
};

export type FrequencyCounters = {
  readonly dayCount: number;
  readonly weekCount: number;
};

export function assertWithinFrequencyCap(input: {
  policy: FrequencyPolicy | null;
  counters: FrequencyCounters;
}): void {
  if (!input.policy) return;
  if (input.counters.dayCount >= input.policy.maxPerDay) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Frequency cap exceeded for channel ${input.policy.channel} (day)`,
      [
        {
          channel: input.policy.channel,
          dayCount: input.counters.dayCount,
          maxPerDay: input.policy.maxPerDay,
        },
      ],
    );
  }
  if (input.counters.weekCount >= input.policy.maxPerWeek) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Frequency cap exceeded for channel ${input.policy.channel} (week)`,
      [
        {
          channel: input.policy.channel,
          weekCount: input.counters.weekCount,
          maxPerWeek: input.policy.maxPerWeek,
        },
      ],
    );
  }
}

export function utcDayStart(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function utcWeekStart(d = new Date()): string {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = copy.getUTCDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday-based
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy.toISOString().slice(0, 10);
}

export function assertContentPublishable(input: {
  status: string;
  productLifecycleStatus?: string | null;
  offerStatus?: string | null;
}): void {
  if (input.status !== 'APPROVED' && input.status !== 'IN_REVIEW') {
    // allow APPROVED primarily; IN_REVIEW blocked
  }
  if (input.status !== 'APPROVED') {
    throw new DomainError(ErrorCode.CONFLICT, 'Content must be APPROVED before publish', [
      { status: input.status },
    ]);
  }
  if (input.productLifecycleStatus && input.productLifecycleStatus !== 'PUBLISHED') {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Cannot publish content for unpublished product',
      [{ productLifecycleStatus: input.productLifecycleStatus }],
    );
  }
  if (input.offerStatus && input.offerStatus !== 'PUBLISHED') {
    throw new DomainError(ErrorCode.CONFLICT, 'Cannot publish content referencing inactive offer', [
      { offerStatus: input.offerStatus },
    ]);
  }
}
