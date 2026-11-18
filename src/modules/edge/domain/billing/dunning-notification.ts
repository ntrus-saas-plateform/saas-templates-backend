import type { DunningPhase } from './dunning-policy.js';

export type DunningChannel = 'EMAIL' | 'SMS' | 'IN_APP' | 'OPS_QUEUE';

export type DunningNotificationPlan = {
  readonly channel: DunningChannel;
  readonly templateRef: string;
  readonly reason: string;
};

const PHASE_TEMPLATES: Record<DunningPhase, DunningNotificationPlan | null> = {
  GRACE: {
    channel: 'EMAIL',
    templateRef: 'billing.dunning.grace_reminder.v1',
    reason: 'Grace-period payment reminder',
  },
  POST_GRACE: {
    channel: 'EMAIL',
    templateRef: 'billing.dunning.suspension_warning.v1',
    reason: 'Post-grace suspension warning',
  },
  ESCALATED: {
    channel: 'EMAIL',
    templateRef: 'billing.dunning.suspended.v1',
    reason: 'Escalated delinquency / suspended notice',
  },
  RESOLVED: {
    channel: 'EMAIL',
    templateRef: 'billing.dunning.reactivated.v1',
    reason: 'Collection resolved — reactivation notice',
  },
  INACTIVE: null,
};

/** Map dunning phase → notification plan (null = no auto-notify). */
export function planDunningNotification(phase: DunningPhase): DunningNotificationPlan | null {
  return PHASE_TEMPLATES[phase] ?? null;
}

export function resolveDunningRecipient(input: {
  billingProfileEmail?: string | null;
  partyEmail?: string | null;
  metadataEmail?: string | null;
}): string | null {
  const candidates = [input.billingProfileEmail, input.partyEmail, input.metadataEmail];
  for (const c of candidates) {
    if (typeof c === 'string' && c.includes('@')) return c.trim();
  }
  return null;
}
