import { describe, expect, it } from 'vitest';
import { planDunningNotification, resolveDunningRecipient } from './dunning-notification.js';

describe('dunning-notification', () => {
  it('plans email templates per phase', () => {
    expect(planDunningNotification('GRACE')?.templateRef).toContain('grace');
    expect(planDunningNotification('ESCALATED')?.templateRef).toContain('suspended');
    expect(planDunningNotification('INACTIVE')).toBeNull();
  });

  it('resolves recipient email fail-closed', () => {
    expect(resolveDunningRecipient({ metadataEmail: 'a@b.co' })).toBe('a@b.co');
    expect(resolveDunningRecipient({})).toBeNull();
  });
});
