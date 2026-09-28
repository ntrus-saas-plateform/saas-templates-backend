export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED',
}

export enum OrganizationType {
  BRANCH = 'BRANCH',
  STORE = 'STORE',
  OFFICE = 'OFFICE',
  WAREHOUSE = 'WAREHOUSE',
  OTHER = 'OTHER',
}

/** Max hierarchy depth (root = 0). */
export const ORGANIZATION_MAX_DEPTH = 8;

export interface OrganizationAddress {
  readonly line1?: string;
  readonly line2?: string;
  readonly country?: string;
  readonly province?: string;
  readonly commune?: string;
  readonly zone?: string;
  readonly quartier?: string;
  readonly city?: string;
  readonly postalCode?: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

export interface OrganizationContact {
  readonly phone?: string;
  readonly email?: string;
  readonly website?: string;
}

export type DayHours = { readonly open: string; readonly close: string } | null;

export interface OpeningHours {
  readonly monday?: DayHours;
  readonly tuesday?: DayHours;
  readonly wednesday?: DayHours;
  readonly thursday?: DayHours;
  readonly friday?: DayHours;
  readonly saturday?: DayHours;
  readonly sunday?: DayHours;
}

export interface OperationalSettings {
  readonly defaultCurrency?: string;
  readonly defaultTaxCategoryId?: string;
  readonly defaultPriceListId?: string;
  readonly defaultWarehouseId?: string;
  readonly defaultPosId?: string;
  readonly defaultCashRegisterId?: string;
  readonly defaultPaymentMethods?: readonly string[];
  readonly businessDays?: readonly number[];
  readonly holidayCalendarId?: string;
}

export interface Organization {
  readonly id: string;
  readonly tenantId: string;
  readonly keycloakOrganizationId: string;
  readonly name: string;
  readonly slug: string;
  readonly status: OrganizationStatus;
  readonly type: OrganizationType;
  readonly code: string | null;
  readonly parentId: string | null;
  readonly isPrimary: boolean;
  readonly description: string | null;
  readonly timezone: string | null;
  readonly locale: string | null;
  readonly address: OrganizationAddress;
  readonly contact: OrganizationContact;
  readonly openingHours: OpeningHours;
  readonly operationalSettings: OperationalSettings;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function isOrganizationAccessible(status: OrganizationStatus): boolean {
  return status === OrganizationStatus.ACTIVE;
}
