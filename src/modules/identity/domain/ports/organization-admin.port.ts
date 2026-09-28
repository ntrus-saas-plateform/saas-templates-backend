import type {
  OpeningHours,
  OperationalSettings,
  Organization,
  OrganizationAddress,
  OrganizationContact,
  OrganizationStatus,
  OrganizationType,
} from '../organization/organization.entity.js';

export interface CreateOrganizationParams {
  tenantId: string;
  name: string;
  slug: string;
  keycloakOrganizationId?: string;
  description?: string;
  timezone?: string;
  locale?: string;
  type?: OrganizationType;
  code?: string;
  parentId?: string | null;
  isPrimary?: boolean;
  address?: OrganizationAddress;
  contact?: OrganizationContact;
  openingHours?: OpeningHours;
  operationalSettings?: OperationalSettings;
  metadata?: Record<string, unknown>;
}

export interface UpdateOrganizationParams {
  name?: string;
  slug?: string;
  description?: string;
  timezone?: string;
  locale?: string;
  type?: OrganizationType;
  code?: string | null;
  parentId?: string | null;
  isPrimary?: boolean;
  address?: OrganizationAddress;
  contact?: OrganizationContact;
  openingHours?: OpeningHours;
  operationalSettings?: OperationalSettings;
  metadata?: Record<string, unknown>;
}

export interface OrganizationAdminPort {
  create(params: CreateOrganizationParams, client?: unknown): Promise<Organization>;
  update(
    tenantId: string,
    organizationId: string,
    params: UpdateOrganizationParams,
    client?: unknown,
  ): Promise<Organization>;
  transitionStatus(
    tenantId: string,
    organizationId: string,
    status: OrganizationStatus,
    client?: unknown,
  ): Promise<Organization>;
  updateKeycloakOrganizationId(
    tenantId: string,
    organizationId: string,
    keycloakOrganizationId: string,
    client?: unknown,
  ): Promise<Organization>;
  clearPrimary(
    tenantId: string,
    exceptOrganizationId?: string | null,
    client?: unknown,
  ): Promise<void>;
  getAncestorChain(
    tenantId: string,
    organizationId: string,
    client?: unknown,
  ): Promise<readonly string[]>;
}

export const ORGANIZATION_ADMIN_PORT = Symbol('ORGANIZATION_ADMIN_PORT');
