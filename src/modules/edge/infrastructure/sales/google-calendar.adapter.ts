import { Injectable, Inject } from '@nestjs/common';
import type {
  CalendarSyncInput,
  CalendarSyncResult,
  SalesCalendarAdapterPort,
} from '../../domain/sales/calendar-adapter.port.js';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { LoggerService } from '../../../../shared/logging/logger.service.js';

/**
 * Live Google Calendar adapter. SYNCED only on 2xx with event id.
 */
@Injectable()
export class GoogleSalesCalendarAdapter implements SalesCalendarAdapterPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly logger: LoggerService,
  ) {}

  async syncActivity(input: CalendarSyncInput): Promise<CalendarSyncResult> {
    const token = this.config.GOOGLE_CALENDAR_ACCESS_TOKEN;
    if (!token) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'GOOGLE_CALENDAR_TOKEN_MISSING',
        failureMessage: 'GOOGLE_CALENDAR_ACCESS_TOKEN is not configured',
      };
    }
    if (!input.scheduledStartAt) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'GOOGLE_CALENDAR_START_MISSING',
        failureMessage: 'Activity scheduledStartAt is required for calendar sync',
      };
    }

    const calendarId = encodeURIComponent(this.config.GOOGLE_CALENDAR_ID || 'primary');
    const start = input.scheduledStartAt;
    const end =
      input.scheduledEndAt ??
      new Date(new Date(start).getTime() + 30 * 60_000).toISOString();

    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: input.subject,
            description: `Edge activity ${input.activityId}`,
            start: { dateTime: start },
            end: { dateTime: end },
            attendees: (input.participants ?? []).map((email) => ({ email })),
            extendedProperties: {
              private: { edgeActivityId: input.activityId },
            },
          }),
        },
      );
      const bodyText = await res.text().catch(() => '');
      if (!res.ok) {
        this.logger.warn('Google Calendar sync rejected', {
          status: res.status,
          activityId: input.activityId,
        });
        return {
          outcome: 'UNAVAILABLE',
          failureCode: `GOOGLE_CALENDAR_HTTP_${res.status}`,
          failureMessage: `Google Calendar ${res.status}: ${bodyText.slice(0, 400)}`,
        };
      }

      let eventId = '';
      try {
        const json = JSON.parse(bodyText) as { id?: string };
        eventId = json.id ?? '';
      } catch {
        /* ignore */
      }
      if (!eventId) {
        return {
          outcome: 'UNAVAILABLE',
          failureCode: 'GOOGLE_CALENDAR_EVENT_ID_MISSING',
          failureMessage: 'Google Calendar response missing event id',
        };
      }

      return { outcome: 'SYNCED', provider: 'google', externalRef: eventId };
    } catch (error) {
      this.logger.warn('Google Calendar transport error', {
        error: error instanceof Error ? error.message : String(error),
        activityId: input.activityId,
      });
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'GOOGLE_CALENDAR_TRANSPORT_ERROR',
        failureMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
