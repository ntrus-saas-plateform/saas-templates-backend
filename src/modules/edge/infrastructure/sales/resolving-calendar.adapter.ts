import { Injectable, Inject } from '@nestjs/common';
import type {
  CalendarSyncInput,
  CalendarSyncResult,
  SalesCalendarAdapterPort,
} from '../../domain/sales/calendar-adapter.port.js';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { UnavailableSalesCalendarAdapter } from './unavailable-calendar.adapter.js';
import { GoogleSalesCalendarAdapter } from './google-calendar.adapter.js';
import { OutlookSalesCalendarAdapter } from './outlook-calendar.adapter.js';

/**
 * Routes calendar sync by SALES_CALENDAR_ADAPTER (or auto from credentials).
 * Default UNAVAILABLE — activities remain Edge-only.
 */
@Injectable()
export class ResolvingSalesCalendarAdapter implements SalesCalendarAdapterPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly unavailable: UnavailableSalesCalendarAdapter,
    private readonly google: GoogleSalesCalendarAdapter,
    private readonly outlook: OutlookSalesCalendarAdapter,
  ) {}

  private resolveMode(): 'unavailable' | 'google' | 'outlook' {
    if (this.config.SALES_CALENDAR_ADAPTER === 'auto') {
      if (this.config.GOOGLE_CALENDAR_ACCESS_TOKEN) return 'google';
      if (this.config.OUTLOOK_CALENDAR_ACCESS_TOKEN) return 'outlook';
      return 'unavailable';
    }
    return this.config.SALES_CALENDAR_ADAPTER;
  }

  async syncActivity(input: CalendarSyncInput): Promise<CalendarSyncResult> {
    switch (this.resolveMode()) {
      case 'google':
        return this.google.syncActivity(input);
      case 'outlook':
        return this.outlook.syncActivity(input);
      case 'unavailable':
      default:
        return this.unavailable.syncActivity(input);
    }
  }
}
