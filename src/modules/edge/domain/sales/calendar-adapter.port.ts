export const SALES_CALENDAR_ADAPTER_PORT = Symbol('SALES_CALENDAR_ADAPTER_PORT');

export type CalendarSyncInput = {
  readonly activityId: string;
  readonly subject: string;
  readonly scheduledStartAt?: string | null;
  readonly scheduledEndAt?: string | null;
  readonly participants?: readonly string[];
};

export type CalendarSyncResult =
  | { readonly outcome: 'SYNCED'; readonly provider: string; readonly externalRef: string }
  | {
      readonly outcome: 'UNAVAILABLE';
      readonly failureCode: string;
      readonly failureMessage: string;
    };

export interface SalesCalendarAdapterPort {
  syncActivity(input: CalendarSyncInput): Promise<CalendarSyncResult>;
}
