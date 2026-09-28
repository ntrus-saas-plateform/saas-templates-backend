import type {
  OpeningHours,
  OperationalSettings,
  Organization,
  OrganizationAddress,
  OrganizationContact,
  OrganizationStatus,
  OrganizationType,
} from '../organization/organization.entity.js';
import { OrganizationType as OrgType } from '../organization/organization.entity.js';

export const ORGANIZATION_SELECT_COLUMNS = `
  id, tenant_id, keycloak_organization_id, name, slug, status, type, code, parent_id, is_primary,
  description, timezone, locale, address, contact, opening_hours, operational_settings, metadata,
  created_at, updated_at
`.replace(/\s+/g, ' ').trim();

export interface OrganizationRow {
  id: string;
  tenant_id: string;
  keycloak_organization_id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  type: string;
  code: string | null;
  parent_id: string | null;
  is_primary: boolean;
  description: string | null;
  timezone: string | null;
  locale: string | null;
  address: Record<string, unknown> | null;
  contact: Record<string, unknown> | null;
  opening_hours: Record<string, unknown> | null;
  operational_settings: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export function mapOrganizationRow(row: OrganizationRow): Organization {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    keycloakOrganizationId: row.keycloak_organization_id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    type: (row.type as OrganizationType) ?? OrgType.OTHER,
    code: row.code ?? null,
    parentId: row.parent_id ?? null,
    isPrimary: Boolean(row.is_primary),
    description: row.description,
    timezone: row.timezone,
    locale: row.locale,
    address: (row.address ?? {}) as OrganizationAddress,
    contact: (row.contact ?? {}) as OrganizationContact,
    openingHours: (row.opening_hours ?? {}) as OpeningHours,
    operationalSettings: (row.operational_settings ?? {}) as OperationalSettings,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
