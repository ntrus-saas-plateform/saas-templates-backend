import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DUNNING_POLICY_RULES,
  evaluateDunningLifecycle,
  parseDunningPolicyRules,
} from './dunning-policy.js';

describe('dunning-policy', () => {
  it('parses legacy {graceDays,maxRetries} with enterprise defaults', () => {
    const rules = parseDunningPolicyRules({ graceDays: 7, maxRetries: 3 });
    expect(rules.graceDays).toBe(7);
    expect(rules.maxRetries).toBe(3);
    expect(rules.restrictDuringGrace).toBe(true);
    expect(rules.suspendAfterGrace).toBe(true);
    expect(rules.suspendOnEscalate).toBe(true);
    expect(rules.reactivateOnResolve).toBe(true);
    expect(rules.restrictionMode).toBe('PAST_DUE');
  });

  it('marks PAST_DUE during grace when restrictDuringGrace', () => {
    const overdueSince = new Date('2026-11-10T00:00:00Z');
    const asOf = new Date('2026-11-12T00:00:00Z');
    const ev = evaluateDunningLifecycle({
      caseStatus: 'OPEN',
      overdueSince,
      asOf,
      rules: DEFAULT_DUNNING_POLICY_RULES,
    });
    expect(ev.phase).toBe('GRACE');
    expect(ev.action).toBe('MARK_PAST_DUE');
    expect(ev.daysOverdue).toBe(2);
  });

  it('suspends after grace ends', () => {
    const overdueSince = new Date('2026-11-01T00:00:00Z');
    const asOf = new Date('2026-11-10T00:00:00Z');
    const ev = evaluateDunningLifecycle({
      caseStatus: 'IN_PROGRESS',
      overdueSince,
      asOf,
      rules: DEFAULT_DUNNING_POLICY_RULES,
    });
    expect(ev.phase).toBe('POST_GRACE');
    expect(ev.action).toBe('SUSPEND');
  });

  it('suspends on escalate even inside grace', () => {
    const overdueSince = new Date('2026-11-16T00:00:00Z');
    const asOf = new Date('2026-11-17T00:00:00Z');
    const ev = evaluateDunningLifecycle({
      caseStatus: 'ESCALATED',
      overdueSince,
      asOf,
      rules: DEFAULT_DUNNING_POLICY_RULES,
    });
    expect(ev.phase).toBe('ESCALATED');
    expect(ev.action).toBe('SUSPEND');
  });

  it('reactivates on resolve when policy allows', () => {
    const ev = evaluateDunningLifecycle({
      caseStatus: 'RESOLVED',
      overdueSince: new Date(),
      rules: DEFAULT_DUNNING_POLICY_RULES,
    });
    expect(ev.phase).toBe('RESOLVED');
    expect(ev.action).toBe('REACTIVATE');
  });

  it('fail-closed when overdueSince missing on open case', () => {
    const ev = evaluateDunningLifecycle({
      caseStatus: 'OPEN',
      overdueSince: null,
      rules: DEFAULT_DUNNING_POLICY_RULES,
    });
    expect(ev.action).toBe('NONE');
    expect(ev.reason).toMatch(/overdueSince missing/);
  });
});
