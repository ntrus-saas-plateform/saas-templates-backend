import type {
  PlatformAdministrator,
  PlatformAdministratorStatus,
} from '../administrator/platform-administrator.entity.js';

export interface CreateAdministratorParams {
  externalIdentityId: string;
  email: string;
  displayName: string;
  preferredLanguage?: string;
  timezone?: string;
  status: PlatformAdministratorStatus;
  emailVerified?: boolean;
  mfaEnrolled?: boolean;
  createdBy?: string | null;
}

export interface UpdateAdministratorProfileParams {
  displayName?: string;
  preferredLanguage?: string;
  timezone?: string;
  profilePictureRef?: string | null;
  updatedBy?: string | null;
}

export interface AdministratorRepositoryPort {
  findById(id: string): Promise<PlatformAdministrator | null>;
  findByEmail(email: string): Promise<PlatformAdministrator | null>;
  findByExternalIdentityId(externalIdentityId: string): Promise<PlatformAdministrator | null>;
  list(params: {
    page: number;
    limit: number;
    status?: PlatformAdministratorStatus;
    search?: string;
  }): Promise<{ items: readonly PlatformAdministrator[]; total: number }>;
  create(params: CreateAdministratorParams): Promise<PlatformAdministrator>;
  updateProfile(
    id: string,
    params: UpdateAdministratorProfileParams,
  ): Promise<PlatformAdministrator>;
  updateStatus(
    id: string,
    status: PlatformAdministratorStatus,
    extras?: {
      suspensionReason?: string | null;
      suspendedAt?: Date | null;
      deactivatedAt?: Date | null;
      updatedBy?: string | null;
      lastSuccessfulAccessAt?: Date | null;
      emailVerified?: boolean;
      mfaEnrolled?: boolean;
      externalIdentityId?: string;
    },
  ): Promise<PlatformAdministrator>;
}

export const ADMINISTRATOR_REPOSITORY_PORT = Symbol('ADMINISTRATOR_REPOSITORY_PORT');
