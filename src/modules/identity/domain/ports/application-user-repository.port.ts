import type { ApplicationUser, ApplicationUserProfile, ApplicationUserStatus } from '../user/application-user.entity.js';

export interface ApplicationUserRepositoryPort {
  findByIdentity(tenantId: string, identityId: string): Promise<ApplicationUser | null>;
  findById(tenantId: string, id: string): Promise<ApplicationUser | null>;
  /** Resolve by Keycloak sub or application_users.id (deep links / list row ids). */
  findByIdentityOrId(tenantId: string, identityOrUserId: string): Promise<ApplicationUser | null>;
  create(
    params: {
      identityId: string;
      tenantId: string;
      status?: ApplicationUserStatus;
      profile?: ApplicationUserProfile;
    },
    client?: unknown,
  ): Promise<ApplicationUser>;
  updateProfile(
    tenantId: string,
    identityId: string,
    profile: ApplicationUserProfile,
    client?: unknown,
  ): Promise<ApplicationUser>;
  updateStatus(
    tenantId: string,
    identityId: string,
    status: ApplicationUserStatus,
    client?: unknown,
  ): Promise<ApplicationUser>;
  touchLastSeen(tenantId: string, identityId: string): Promise<void>;
  listPage(
    tenantId: string,
    page: number,
    limit: number,
    status?: ApplicationUserStatus,
    search?: string,
  ): Promise<{ items: readonly ApplicationUser[]; total: number }>;
}

export const APPLICATION_USER_REPOSITORY_PORT = Symbol('APPLICATION_USER_REPOSITORY_PORT');
