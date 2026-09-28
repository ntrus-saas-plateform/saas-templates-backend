import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type { ApplicationUserRepositoryPort } from '../../domain/ports/application-user-repository.port.js';
import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import type { OrganizationRepositoryPort } from '../../domain/ports/organization-repository.port.js';
import type {
  ApplicationUser,
  UserEmploymentProjection,
} from '../../domain/user/application-user.entity.js';
import {
  ApplicationUserStatus,
  mergeApplicationUserProfile,
} from '../../domain/user/application-user.entity.js';
import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { FileStoragePort } from '../../../../core/domain/ports/file-storage.port.js';
import type { PaginatedResult } from '../common/pagination.js';
import { buildPaginationMeta, normalizePageLimit } from '../common/pagination.js';
import { attachUserOrganizations } from './attach-user-organizations.js';

async function withEmployment(
  user: ApplicationUser,
  ctx: ExecutionContext,
  membershipRepository: MembershipRepositoryPort,
  organizationRepository: OrganizationRepositoryPort,
): Promise<ApplicationUser> {
  if (!ctx.organizationId) {
    return { ...user, employment: null };
  }
  const memberships = await membershipRepository.findByUser(ctx.tenantId, ctx.subjectId!);
  const membership = memberships.find((m) => m.organizationId === ctx.organizationId);
  if (!membership) {
    return { ...user, employment: null };
  }
  const org = await organizationRepository.findById(ctx.tenantId, membership.organizationId);
  const employment: UserEmploymentProjection = {
    organizationId: membership.organizationId,
    organizationName: org?.name ?? null,
    department: membership.department ?? null,
    position: membership.position ?? null,
    managerUserId: membership.managerUserId ?? null,
    joinedAt: membership.joinedAt ? membership.joinedAt.toISOString() : null,
    status: membership.status,
    roles: membership.roles ?? [],
  };
  return { ...user, employment };
}

export class GetMyProfileUseCase
  implements UseCase<{ ctx: ExecutionContext }, ApplicationUser>
{
  constructor(
    private readonly applicationUserRepository: ApplicationUserRepositoryPort,
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly organizationRepository: OrganizationRepositoryPort,
  ) {}

  async execute(input: { ctx: ExecutionContext }): Promise<ApplicationUser> {
    const ctx = requireSubject(input.ctx);
    let user = await this.applicationUserRepository.findByIdentity(ctx.tenantId, ctx.subjectId);
    if (!user) {
      user = await this.applicationUserRepository.create({
        identityId: ctx.subjectId,
        tenantId: ctx.tenantId,
        status: ApplicationUserStatus.ACTIVE,
        profile: { displayName: ctx.username ?? undefined },
      });
    }
    await this.applicationUserRepository.touchLastSeen(ctx.tenantId, ctx.subjectId);
    return withEmployment(
      user,
      ctx,
      this.membershipRepository,
      this.organizationRepository,
    );
  }
}

export class UpdateMyProfileUseCase
  implements UseCase<{ ctx: ExecutionContext; profile: Record<string, unknown> }, ApplicationUser>
{
  constructor(
    private readonly applicationUserRepository: ApplicationUserRepositoryPort,
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly organizationRepository: OrganizationRepositoryPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    profile: Record<string, unknown>;
  }): Promise<ApplicationUser> {
    const ctx = requireSubject(input.ctx);
    let user = await this.applicationUserRepository.findByIdentity(ctx.tenantId, ctx.subjectId);
    if (!user) {
      user = await this.applicationUserRepository.create({
        identityId: ctx.subjectId,
        tenantId: ctx.tenantId,
        status: ApplicationUserStatus.ACTIVE,
        profile: {},
      });
    }
    const merged = mergeApplicationUserProfile(user.profile, input.profile);
    const updated = await this.applicationUserRepository.updateProfile(
      ctx.tenantId,
      ctx.subjectId,
      merged,
    );
    return withEmployment(
      updated,
      ctx,
      this.membershipRepository,
      this.organizationRepository,
    );
  }
}

const AVATAR_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export type AvatarUploadFile = {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly originalname: string;
  readonly size: number;
};

export class UploadMyAvatarUseCase
  implements UseCase<{ ctx: ExecutionContext; file: AvatarUploadFile }, ApplicationUser>
{
  constructor(
    private readonly applicationUserRepository: ApplicationUserRepositoryPort,
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly storage: FileStoragePort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    file: AvatarUploadFile;
  }): Promise<ApplicationUser> {
    const ctx = requireSubject(input.ctx);
    const ext = AVATAR_TYPES[input.file.mimetype];
    if (!ext) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Avatar must be a JPEG, PNG, WebP, or GIF image',
      );
    }
    if (input.file.size > 2 * 1024 * 1024) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Avatar must be 2 MB or smaller');
    }

    let user = await this.applicationUserRepository.findByIdentity(ctx.tenantId, ctx.subjectId);
    if (!user) {
      user = await this.applicationUserRepository.create({
        identityId: ctx.subjectId,
        tenantId: ctx.tenantId,
        status: ApplicationUserStatus.ACTIVE,
        profile: {},
      });
    }

    const key = `avatars/${user.id}.${ext}`;
    await this.storage.upload(key, input.file.buffer, {
      filename: input.file.originalname || `avatar.${ext}`,
      mimeType: input.file.mimetype,
      size: input.file.size,
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
    });

    const merged = mergeApplicationUserProfile(user.profile, { avatarUrl: key });
    const updated = await this.applicationUserRepository.updateProfile(
      ctx.tenantId,
      ctx.subjectId,
      merged,
    );
    return withEmployment(
      updated,
      ctx,
      this.membershipRepository,
      this.organizationRepository,
    );
  }
}

export class GetUserByIdentityUseCase
  implements UseCase<{ ctx: ExecutionContext; identityId: string }, ApplicationUser>
{
  constructor(
    private readonly applicationUserRepository: ApplicationUserRepositoryPort,
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly organizationRepository: OrganizationRepositoryPort,
  ) {}

  async execute(input: { ctx: ExecutionContext; identityId: string }): Promise<ApplicationUser> {
    const ctx = requireSubject(input.ctx);
    const user = await this.applicationUserRepository.findByIdentityOrId(
      ctx.tenantId,
      input.identityId,
    );
    if (!user) throw accessDeniedError();
    const [enriched] = await attachUserOrganizations(
      ctx.tenantId,
      [user],
      this.membershipRepository,
      this.organizationRepository,
    );
    return enriched ?? user;
  }
}

export class ListMyMembershipsUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; page?: number; limit?: number },
      PaginatedResult<import('../../domain/membership/organization-membership.entity.js').OrganizationMembership>
    >
{
  constructor(private readonly membershipRepository: MembershipRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    page?: number;
    limit?: number;
  }) {
    const ctx = requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const result = await this.membershipRepository.findByUserPage(
      ctx.tenantId,
      ctx.subjectId,
      page,
      limit,
    );
    return {
      data: result.items,
      pagination: buildPaginationMeta(page, limit, result.total),
    };
  }
}
