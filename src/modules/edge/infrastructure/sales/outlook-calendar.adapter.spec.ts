import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEnvironment } from '../../../../shared/configuration/environment.schema.js';
import type { LoggerService } from '../../../../shared/logging/logger.service.js';
import { OutlookSalesCalendarAdapter } from './outlook-calendar.adapter.js';

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerService;

describe('OutlookSalesCalendarAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns UNAVAILABLE without token', async () => {
    const adapter = new OutlookSalesCalendarAdapter(
      parseEnvironment({ CONTROL_PLANE_DB_PASSWORD: 'test' }),
      logger,
    );
    const result = await adapter.syncActivity({
      activityId: 'a1',
      subject: 'Demo',
      scheduledStartAt: '2026-11-10T10:00:00Z',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
  });

  it('returns SYNCED with event id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: 'outlook-1' }), { status: 201 }),
      ),
    );

    const adapter = new OutlookSalesCalendarAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        OUTLOOK_CALENDAR_ACCESS_TOKEN: 'o_tok',
      }),
      logger,
    );

    const result = await adapter.syncActivity({
      activityId: 'a1',
      subject: 'Demo',
      scheduledStartAt: '2026-11-10T10:00:00Z',
    });
    expect(result).toEqual({
      outcome: 'SYNCED',
      provider: 'outlook',
      externalRef: 'outlook-1',
    });
  });
});
