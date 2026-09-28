export enum ApplicationUserStatus {
  INVITED = 'INVITED',
  PENDING_ACTIVATION = 'PENDING_ACTIVATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  LOCKED = 'LOCKED',
  DISABLED = 'DISABLED',
  DELETED = 'DELETED',
}

export type ApplicationUserAddress = {
  readonly line1?: string;
  readonly line2?: string;
  readonly city?: string;
  readonly region?: string;
  readonly postalCode?: string;
  readonly country?: string;
};

export interface ApplicationUserProfile {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
  readonly preferredName?: string;
  readonly avatarUrl?: string;
  readonly gender?: string;
  readonly dateOfBirth?: string;
  readonly biography?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly mobile?: string;
  readonly alternatePhone?: string;
  readonly address?: ApplicationUserAddress;
  readonly employeeNumber?: string;
  readonly jobTitle?: string;
}

export type UserEmploymentProjection = {
  readonly organizationId: string;
  readonly organizationName?: string | null;
  readonly department?: string | null;
  readonly position?: string | null;
  readonly managerUserId?: string | null;
  readonly joinedAt?: string | null;
  readonly status?: string | null;
  readonly roles: readonly string[];
};

export type UserOrganizationSummary = {
  readonly organizationId: string;
  readonly organizationName?: string | null;
  readonly roles: readonly string[];
  readonly department?: string | null;
  readonly position?: string | null;
  readonly status?: string | null;
};

export interface ApplicationUser {
  readonly id: string;
  readonly identityId: string;
  readonly tenantId: string;
  readonly status: ApplicationUserStatus;
  readonly profile: ApplicationUserProfile;
  readonly securityMetadata: Readonly<Record<string, unknown>>;
  readonly lastSeenAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly employment?: UserEmploymentProjection | null;
  readonly organizations?: readonly UserOrganizationSummary[];
}

export function isApplicationUserAccessible(status: ApplicationUserStatus): boolean {
  return status === ApplicationUserStatus.ACTIVE;
}

/** Merge patch into existing profile; omit undefined keys; allow null to clear optional strings. */
export function mergeApplicationUserProfile(
  current: ApplicationUserProfile,
  patch: Record<string, unknown>,
): ApplicationUserProfile {
  const next: Record<string, unknown> = { ...current };

  const stringKeys = [
    'firstName',
    'lastName',
    'displayName',
    'preferredName',
    'avatarUrl',
    'gender',
    'dateOfBirth',
    'biography',
    'email',
    'phone',
    'mobile',
    'alternatePhone',
    'employeeNumber',
    'jobTitle',
  ] as const;

  for (const key of stringKeys) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === null || value === '') {
      delete next[key];
    } else if (typeof value === 'string') {
      next[key] = value;
    }
  }

  if ('address' in patch) {
    const address = patch.address;
    if (address === null) {
      delete next.address;
    } else if (address && typeof address === 'object' && !Array.isArray(address)) {
      const src = address as Record<string, unknown>;
      const addr: ApplicationUserAddress = {};
      for (const k of ['line1', 'line2', 'city', 'region', 'postalCode', 'country'] as const) {
        const v = src[k];
        if (typeof v === 'string' && v.trim()) {
          (addr as Record<string, string>)[k] = v.trim();
        }
      }
      if (Object.keys(addr).length > 0) next.address = addr;
      else delete next.address;
    }
  }

  return next as ApplicationUserProfile;
}
