import { describe, expect, it, vi } from 'vitest';
import { parseEnvironment } from '../../../../shared/configuration/environment.schema.js';
import { ResolvingSalesCalendarAdapter } from './resolving-calendar.adapter.js';
import { UnavailableSalesCalendarAdapter } from './unavailable-calendar.adapter.js';
import type { GoogleSalesCalendarAdapter } from './google-calendar.adapter.js';
import type { OutlookSalesCalendarAdapter } from './outlook-calendar.adapter.js';

describe('ResolvingSalesCalendarAdapter', () => {
  const input = {
    activityId: 'a1',
    subject: 'Call',
    scheduledStartAt: '2026-11-10T10:00:00Z',
  };

  it('defaults to unavailable', async () => {
    const unavailable = new UnavailableSalesCalendarAdapter();
    const google = { syncActivity: vi.fn() } as unknown as GoogleSalesCalendarAdapter;
    const outlook = {
      syncActivity: vi.fn(),
    } as unknown as OutlookSalesCalendarAdapter;

    const adapter = new ResolvingSalesCalendarAdapter(
      parseEnvironment({ CONTROL_PLANE_DB_PASSWORD: 'test' }),
      unavailable,
      google,
      outlook,
    );

    const result = await adapter.syncActivity(input);
    expect(result.outcome).toBe('UNAVAILABLE');
    expect(google.syncActivity).not.toHaveBeenCalled();
  });

  it('auto selects google when token present', async () => {
    const unavailable = new UnavailableSalesCalendarAdapter();
    const google = {
      syncActivity: vi.fn(async () => ({
        outcome: 'SYNCED' as const,
        provider: 'google',
        externalRef: 'g1',
      })),
    } as unknown as GoogleSalesCalendarAdapter;
    const outlook = {
      syncActivity: vi.fn(),
    } as unknown as OutlookSalesCalendarAdapter;

    const adapter = new ResolvingSalesCalendarAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        SALES_CALENDAR_ADAPTER: 'auto',
        GOOGLE_CALENDAR_ACCESS_TOKEN: 'tok',
      }),
      unavailable,
      google,
      outlook,
    );

    const result = await adapter.syncActivity(input);
    expect(result.outcome).toBe('SYNCED');
    expect(google.syncActivity).toHaveBeenCalled();
  });
});
