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
 * Live Microsoft Graph calendar adapter. SYNCED only on 2xx with event id.
 */
@Injectable()
export class OutlookSalesCalendarAdapter implements SalesCalendarAdapterPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly logger: LoggerService,
  ) {}

  async syncActivity(input: CalendarSyncInput): Promise<CalendarSyncResult> {
    const token = this.config.OUTLOOK_CALENDAR_ACCESS_TOKEN;
    if (!token) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'OUTLOOK_CALENDAR_TOKEN_MISSING',
        failureMessage: 'OUTLOOK_CALENDAR_ACCESS_TOKEN is not configured',
      };
    }
    if (!input.scheduledStartAt) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'OUTLOOK_CALENDAR_START_MISSING',
        failureMessage: 'Activity scheduledStartAt is required for calendar sync',
      };
    }

    const start = input.scheduledStartAt;
    const end =
      input.scheduledEndAt ??
      new Date(new Date(start).getTime() + 30 * 60_000).toISOString();

    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: input.subject,
          body: {
            contentType: 'Text',
            content: `Edge activity ${input.activityId}`,
          },
          start: { dateTime: start, timeZone: 'UTC' },
          end: { dateTime: end, timeZone: 'UTC' },
          attendees: (input.participants ?? []).map((email) => ({
            emailAddress: { address: email },
            type: 'required',
          })),
          singleValueExtendedProperties: [
            {
              id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name EdgeActivityId',
              value: input.activityId,
            },
          ],
        }),
      });
      const bodyText = await res.text().catch(() => '');
      if (!res.ok) {
        this.logger.warn('Outlook Calendar sync rejected', {
          status: res.status,
          activityId: input.activityId,
        });
        return {
          outcome: 'UNAVAILABLE',
          failureCode: `OUTLOOK_CALENDAR_HTTP_${res.status}`,
          failureMessage: `Outlook ${res.status}: ${bodyText.slice(0, 400)}`,
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
          failureCode: 'OUTLOOK_CALENDAR_EVENT_ID_MISSING',
          failureMessage: 'Outlook response missing event id',
        };
      }

      return { outcome: 'SYNCED', provider: 'outlook', externalRef: eventId };
    } catch (error) {
      this.logger.warn('Outlook Calendar transport error', {
        error: error instanceof Error ? error.message : String(error),
        activityId: input.activityId,
      });
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'OUTLOOK_CALENDAR_TRANSPORT_ERROR',
        failureMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
