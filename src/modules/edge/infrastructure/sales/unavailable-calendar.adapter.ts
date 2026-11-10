import { Injectable } from '@nestjs/common';
import type {
  CalendarSyncInput,
  CalendarSyncResult,
  SalesCalendarAdapterPort,
} from '../../domain/sales/calendar-adapter.port.js';

@Injectable()
export class UnavailableSalesCalendarAdapter implements SalesCalendarAdapterPort {
  async syncActivity(_input: CalendarSyncInput): Promise<CalendarSyncResult> {
    return {
      outcome: 'UNAVAILABLE',
      failureCode: 'PROVIDER_NOT_CONFIGURED',
      failureMessage: 'No calendar provider configured; activity stored in Edge only',
    };
  }
}
