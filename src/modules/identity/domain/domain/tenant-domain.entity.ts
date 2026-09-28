export enum DomainType {
  SUBDOMAIN = 'SUBDOMAIN',
  CUSTOM = 'CUSTOM',
}

export enum DomainStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  DISABLED = 'DISABLED',
}

export interface TenantDomain {
  readonly id: string;
  readonly tenantId: string;
  readonly hostname: string;
  readonly type: DomainType;
  readonly isPrimary: boolean;
  readonly status: DomainStatus;
  readonly verificationToken: string | null;
  readonly verificationMethod: string;
  readonly verifiedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
