import { Injectable } from '@nestjs/common';
import type { RevenueProjectionInputPort } from '../../domain/revenue-operations/revenue-repository.port.js';

/**
 * Stub projection input — returns empty lines until a real P5 subscription projection is wired.
 * Callers must treat empty as UNAVAILABLE (never invent MRR zeros as measured truth).
 */
@Injectable()
export class StubRevenueProjectionAdapter implements RevenueProjectionInputPort {
  async loadNormalizedSubscriptionRevenueLines(_input: {
    periodStart: Date;
    periodEnd: Date;
    currency?: string;
    businessUnitId?: string | null;
  }): Promise<
    Array<{
      subscriptionRefId: string;
      customerRefId?: string | null;
      amount: number;
      currency: string;
      billingPeriod: string;
      isFreeTrial?: boolean;
      paymentStatus?: string;
      movementType: string;
      activeAtPeriodEnd?: boolean;
      activeAtPeriodStart?: boolean;
    }>
  > {
    return [];
  }
}
