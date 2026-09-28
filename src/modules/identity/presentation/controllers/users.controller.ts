import { readFile } from 'node:fs/promises';
import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Post,
  Query,
  Delete,
  Req,
  Headers,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { AuditAction, RequirePermissions } from '../../../../shared/auth/decorators.js';
import { TenantContextService } from '../../../../shared/tenancy/tenant-context.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';
import { ApiErrorResponseDto } from '../../../../shared/swagger/api-response.dto.js';
import { ApiOkDataResponse, ApiJsonBody } from '../../../../shared/swagger/api-decorators.js';
import { PaginationQueryDto } from '../../../../shared/validation/query.dto.js';
import { ListUsersQueryDto } from '../dto/list-users-query.dto.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import {
  GetMyProfileUseCase,
  UpdateMyProfileUseCase,
  UploadMyAvatarUseCase,
  GetUserByIdentityUseCase,
  ListMyMembershipsUseCase,
} from '../../application/user/user.use-cases.js';
import {
  GetMyPreferencesUseCase,
  UpdateMyPreferencesUseCase,
} from '../../application/user/user-preferences.use-cases.js';
import {
  GetMyPersonalizationUseCase,
  UpdateMyPersonalizationUseCase,
  ListMyNotificationsUseCase,
  MarkNotificationReadUseCase,
  MarkAllNotificationsReadUseCase,
  DeleteMyNotificationUseCase,
  CreateMyNotificationUseCase,
  ListMyDevicesUseCase,
  TrustMyDeviceUseCase,
  RemoveMyDeviceUseCase,
} from '../../application/user/user-account-phase2.use-cases.js';
import {
  ListMyLoginHistoryUseCase,
  RecordMyLoginUseCase,
  ListMyApiTokensUseCase,
  CreateMyApiTokenUseCase,
  RevokeMyApiTokenUseCase,
  ListMyActivityUseCase,
  CreateMyActivityUseCase,
  ClearMyActivityUseCase,
  EnrollMyPushDeviceUseCase,
  ClearMyDevicePushUseCase,
} from '../../application/user/user-account-phase3.use-cases.js';
import {
  GetMySecurityOverviewUseCase,
  DeleteMyCredentialUseCase,
} from '../../application/security/user-security.use-cases.js';
import {
  GetMyIdentityOverviewUseCase,
  UnlinkMyIdentityUseCase,
  RequestMyEmailVerificationUseCase,
  RequestMyPasswordResetUseCase,
} from '../../application/security/identity.use-cases.js';
import {
  SendPhoneVerificationOtpUseCase,
  VerifyPhoneVerificationOtpUseCase,
} from '../../application/security/identity-providers-phone.use-cases.js';
import {
  ListUsersUseCase,
  SuspendUserUseCase,
  DisableUserUseCase,
  ReactivateUserUseCase,
} from '../../application/user/user-lifecycle.use-cases.js';
import {
  UpdateUserProfileDto,
  UpdateUserPreferencesDto,
  MySecurityQueryDto,
  UpdatePersonalizationDto,
  ListNotificationsQueryDto,
  CreateNotificationDto,
  ListDevicesQueryDto,
  TrustDeviceDto,
  EnrollPushDeviceDto,
  CreateApiTokenDto,
  CreateActivityDto,
  RecordLoginDto,
  SendPhoneVerificationDto,
  VerifyPhoneVerificationDto,
} from '../dto/user.dto.js';
import { ApplicationUserStatus } from '../../domain/user/application-user.entity.js';
import {
  ApplicationUserResponseDto,
  MyIdentityOverviewDto,
  MySecurityOverviewDto,
  OrganizationMembershipResponseDto,
} from '../dto/identity-response.dto.js';

@ApiTags(SwaggerTags.USERS)
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly getMyProfileUseCase: GetMyProfileUseCase,
    private readonly updateMyProfileUseCase: UpdateMyProfileUseCase,
    private readonly uploadMyAvatarUseCase: UploadMyAvatarUseCase,
    private readonly getMyPreferencesUseCase: GetMyPreferencesUseCase,
    private readonly updateMyPreferencesUseCase: UpdateMyPreferencesUseCase,
    private readonly getMyPersonalizationUseCase: GetMyPersonalizationUseCase,
    private readonly updateMyPersonalizationUseCase: UpdateMyPersonalizationUseCase,
    private readonly listMyNotificationsUseCase: ListMyNotificationsUseCase,
    private readonly markNotificationReadUseCase: MarkNotificationReadUseCase,
    private readonly markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase,
    private readonly deleteMyNotificationUseCase: DeleteMyNotificationUseCase,
    private readonly createMyNotificationUseCase: CreateMyNotificationUseCase,
    private readonly listMyDevicesUseCase: ListMyDevicesUseCase,
    private readonly trustMyDeviceUseCase: TrustMyDeviceUseCase,
    private readonly removeMyDeviceUseCase: RemoveMyDeviceUseCase,
    private readonly enrollMyPushDeviceUseCase: EnrollMyPushDeviceUseCase,
    private readonly clearMyDevicePushUseCase: ClearMyDevicePushUseCase,
    private readonly listMyLoginHistoryUseCase: ListMyLoginHistoryUseCase,
    private readonly recordMyLoginUseCase: RecordMyLoginUseCase,
    private readonly listMyApiTokensUseCase: ListMyApiTokensUseCase,
    private readonly createMyApiTokenUseCase: CreateMyApiTokenUseCase,
    private readonly revokeMyApiTokenUseCase: RevokeMyApiTokenUseCase,
    private readonly listMyActivityUseCase: ListMyActivityUseCase,
    private readonly createMyActivityUseCase: CreateMyActivityUseCase,
    private readonly clearMyActivityUseCase: ClearMyActivityUseCase,
    private readonly getMySecurityOverviewUseCase: GetMySecurityOverviewUseCase,
    private readonly getMyIdentityOverviewUseCase: GetMyIdentityOverviewUseCase,
    private readonly unlinkMyIdentityUseCase: UnlinkMyIdentityUseCase,
    private readonly requestMyEmailVerificationUseCase: RequestMyEmailVerificationUseCase,
    private readonly requestMyPasswordResetUseCase: RequestMyPasswordResetUseCase,
    private readonly sendPhoneVerificationOtpUseCase: SendPhoneVerificationOtpUseCase,
    private readonly verifyPhoneVerificationOtpUseCase: VerifyPhoneVerificationOtpUseCase,
    private readonly deleteMyCredentialUseCase: DeleteMyCredentialUseCase,
    private readonly listMyMembershipsUseCase: ListMyMembershipsUseCase,
    private readonly getUserByIdentityUseCase: GetUserByIdentityUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly suspendUserUseCase: SuspendUserUseCase,
    private readonly disableUserUseCase: DisableUserUseCase,
    private readonly reactivateUserUseCase: ReactivateUserUseCase,
  ) {}

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List application users (paginated)' })
  @ApiQuery({ name: 'status', required: false, enum: ApplicationUserStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOkDataResponse(ApplicationUserResponseDto, true)
  async list(@Query() query: ListUsersQueryDto) {
    const result = await this.listUsersUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
    });
    return { data: result.data, pagination: result.pagination };
  }

  @Get('me')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Get current user application profile (with employment projection)' })
  @ApiOkDataResponse(ApplicationUserResponseDto)
  async getMe() {
    const user = await this.getMyProfileUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data: user };
  }

  @Patch('me')
  @RequirePermissions('users:update')
  @AuditAction('user.profile.update', 'user')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiJsonBody(UpdateUserProfileDto)
  @ApiOkDataResponse(ApplicationUserResponseDto)
  async updateMe(@Body() dto: UpdateUserProfileDto) {
    const user = await this.updateMyProfileUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      profile: dto.profile,
    });
    return { data: user };
  }

  @Post('me/avatar')
  @RequirePermissions('users:update')
  @AuditAction('user.profile.avatar', 'user')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload current user avatar (stored in R2/S3 or local disk)' })
  @ApiOkDataResponse(ApplicationUserResponseDto)
  async uploadAvatar(
    @UploadedFile()
    file?: {
      buffer?: Buffer;
      path?: string;
      mimetype: string;
      originalname: string;
      size: number;
    },
  ) {
    let buffer = file?.buffer;
    if (!buffer && file?.path) {
      buffer = await readFile(file.path);
    }
    if (!file || !buffer) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Avatar file is required');
    }
    const user = await this.uploadMyAvatarUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      file: {
        buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size || buffer.length,
      },
    });
    return { data: user };
  }

  @Get('me/preferences')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Get current user preferences (resolved with tenant/org defaults)' })
  async getMyPreferences() {
    const settings = await this.getMyPreferencesUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data: { settings } };
  }

  @Patch('me/preferences')
  @RequirePermissions('users:update')
  @AuditAction('user.preferences.update', 'user')
  @ApiOperation({ summary: 'Patch current user preferences (flat dotted keys)' })
  @ApiJsonBody(UpdateUserPreferencesDto)
  async updateMyPreferences(@Body() dto: UpdateUserPreferencesDto) {
    const settings = await this.updateMyPreferencesUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      settings: dto.settings,
    });
    return { data: { settings } };
  }

  @Get('me/personalization')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Get shell personalization (favorites, pins, widgets, saved views)' })
  async getMyPersonalization() {
    const personalization = await this.getMyPersonalizationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data: personalization };
  }

  @Patch('me/personalization')
  @RequirePermissions('users:update')
  @AuditAction('user.personalization.update', 'user')
  @ApiOperation({ summary: 'Patch personalization (partial merge of top-level keys)' })
  @ApiJsonBody(UpdatePersonalizationDto)
  async updateMyPersonalization(@Body() dto: UpdatePersonalizationDto) {
    const personalization = await this.updateMyPersonalizationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      personalization: dto.personalization,
    });
    return { data: personalization };
  }

  @Get('me/notifications')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List in-app notification inbox for current user' })
  async listMyNotifications(@Query() query: ListNotificationsQueryDto) {
    const result = await this.listMyNotificationsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: query.page,
      limit: query.limit,
      unreadOnly: query.unreadOnly,
    });
    return {
      data: result.data,
      pagination: result.pagination,
      stats: result.stats,
    };
  }

  @Post('me/notifications')
  @RequirePermissions('users:update')
  @AuditAction('user.notification.create', 'user')
  @ApiOperation({
    summary: 'Create an in-app notification for the current user (seed/self-test)',
  })
  @ApiJsonBody(CreateNotificationDto)
  async createMyNotification(@Body() dto: CreateNotificationDto) {
    const notification = await this.createMyNotificationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      title: dto.title,
      body: dto.body,
      category: dto.category,
      priority: dto.priority,
      payload: dto.payload,
    });
    return { data: notification };
  }

  @Post('me/notifications/read-all')
  @RequirePermissions('users:update')
  @AuditAction('user.notification.read_all', 'user')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllNotificationsRead() {
    const data = await this.markAllNotificationsReadUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data };
  }

  @Post('me/notifications/:notificationId/read')
  @RequirePermissions('users:update')
  @AuditAction('user.notification.read', 'user')
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiParam({ name: 'notificationId' })
  async markNotificationRead(@Param('notificationId') notificationId: string) {
    const data = await this.markNotificationReadUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      notificationId,
    });
    return { data };
  }

  @Delete('me/notifications/:notificationId')
  @RequirePermissions('users:update')
  @AuditAction('user.notification.delete', 'user')
  @ApiOperation({ summary: 'Delete a notification from the inbox' })
  @ApiParam({ name: 'notificationId' })
  async deleteMyNotification(@Param('notificationId') notificationId: string) {
    const data = await this.deleteMyNotificationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      notificationId,
    });
    return { data };
  }

  @Get('me/devices')
  @RequirePermissions('users:read')
  @ApiOperation({
    summary: 'List soft device registry (optionally sync from Keycloak sessions)',
  })
  async listMyDevices(@Query() query: ListDevicesQueryDto) {
    const data = await this.listMyDevicesUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      syncSessions: query.syncSessions,
    });
    return { data };
  }

  @Patch('me/devices/:deviceId')
  @RequirePermissions('users:update')
  @AuditAction('user.device.trust', 'user')
  @ApiOperation({ summary: 'Mark a soft device as trusted / untrusted' })
  @ApiParam({ name: 'deviceId' })
  @ApiJsonBody(TrustDeviceDto)
  async trustMyDevice(
    @Param('deviceId') deviceId: string,
    @Body() dto: TrustDeviceDto,
  ) {
    const data = await this.trustMyDeviceUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      deviceId,
      trusted: dto.trusted,
    });
    return { data };
  }

  @Delete('me/devices/:deviceId')
  @RequirePermissions('users:update')
  @AuditAction('user.device.remove', 'user')
  @ApiOperation({ summary: 'Remove a soft device registry entry' })
  @ApiParam({ name: 'deviceId' })
  async removeMyDevice(@Param('deviceId') deviceId: string) {
    const data = await this.removeMyDeviceUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      deviceId,
    });
    return { data };
  }

  @Post('me/devices/enroll-push')
  @RequirePermissions('users:update')
  @AuditAction('user.device.enroll_push', 'user')
  @ApiOperation({ summary: 'Enroll a hard device for push notifications' })
  @ApiJsonBody(EnrollPushDeviceDto)
  async enrollPushDevice(
    @Body() dto: EnrollPushDeviceDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    const data = await this.enrollMyPushDeviceUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      deviceName: dto.deviceName,
      pushToken: dto.pushToken,
      pushPlatform: dto.pushPlatform,
      platform: dto.platform,
      ip: req.ip ?? null,
      userAgent: userAgent ?? null,
    });
    return { data };
  }

  @Delete('me/devices/:deviceId/push')
  @RequirePermissions('users:update')
  @AuditAction('user.device.clear_push', 'user')
  @ApiOperation({ summary: 'Clear push enrollment for a device' })
  @ApiParam({ name: 'deviceId' })
  async clearDevicePush(@Param('deviceId') deviceId: string) {
    const data = await this.clearMyDevicePushUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      deviceId,
    });
    return { data };
  }

  @Get('me/login-history')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List login history for the current user' })
  async listLoginHistory(@Query() pagination: PaginationQueryDto) {
    const result = await this.listMyLoginHistoryUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: pagination.page,
      limit: pagination.limit,
    });
    return { data: result.data, pagination: result.pagination };
  }

  @Post('me/login-history')
  @RequirePermissions('users:update')
  @AuditAction('user.login.record', 'user')
  @ApiOperation({
    summary: 'Record a login (deduped by JWT jti / session id)',
  })
  @ApiJsonBody(RecordLoginDto)
  async recordLogin(
    @Body() dto: RecordLoginDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    const data = await this.recordMyLoginUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      ip: req.ip ?? null,
      userAgent: userAgent ?? null,
      eventType: dto.eventType,
      success: dto.success,
      metadata: dto.metadata,
    });
    return { data };
  }

  @Get('me/api-tokens')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List personal API tokens (hashes only)' })
  async listApiTokens() {
    const data = await this.listMyApiTokensUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data };
  }

  @Post('me/api-tokens')
  @RequirePermissions('users:update')
  @AuditAction('user.api_token.create', 'user')
  @ApiOperation({
    summary: 'Create a personal API token (plaintext returned once)',
  })
  @ApiJsonBody(CreateApiTokenDto)
  async createApiToken(@Body() dto: CreateApiTokenDto) {
    const data = await this.createMyApiTokenUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      name: dto.name,
      scopes: dto.scopes,
      expiresAt: dto.expiresAt,
    });
    return { data };
  }

  @Delete('me/api-tokens/:tokenId')
  @RequirePermissions('users:update')
  @AuditAction('user.api_token.revoke', 'user')
  @ApiOperation({ summary: 'Revoke a personal API token' })
  @ApiParam({ name: 'tokenId' })
  async revokeApiToken(@Param('tokenId') tokenId: string) {
    const data = await this.revokeMyApiTokenUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      tokenId,
    });
    return { data };
  }

  @Get('me/activity')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List synced activity feed for the current user' })
  async listActivity(@Query() pagination: PaginationQueryDto) {
    const result = await this.listMyActivityUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: pagination.page,
      limit: pagination.limit,
    });
    return { data: result.data, pagination: result.pagination };
  }

  @Post('me/activity')
  @RequirePermissions('users:update')
  @ApiOperation({ summary: 'Append an activity event' })
  @ApiJsonBody(CreateActivityDto)
  async createActivity(@Body() dto: CreateActivityDto) {
    const data = await this.createMyActivityUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      title: dto.title,
      detail: dto.detail,
      category: dto.category,
      href: dto.href,
      payload: dto.payload,
    });
    return { data };
  }

  @Delete('me/activity')
  @RequirePermissions('users:update')
  @AuditAction('user.activity.clear', 'user')
  @ApiOperation({ summary: 'Clear activity feed for the current user' })
  async clearActivity() {
    const data = await this.clearMyActivityUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data };
  }

  @Get('me/identity')
  @RequirePermissions('users:read')
  @ApiOperation({
    summary:
      'Identity overview (Keycloak SoT): credentials, MFA, linked IdPs, verification, enroll URLs',
  })
  @ApiOkDataResponse(MyIdentityOverviewDto)
  async getMyIdentity(@Query() query: MySecurityQueryDto) {
    const data = await this.getMyIdentityOverviewUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      redirectUri: query.redirectUri,
    });
    return { data };
  }

  @Delete('me/identity/links/:provider')
  @RequirePermissions('users:update')
  @AuditAction('user.identity.unlink', 'user')
  @ApiOperation({ summary: 'Unlink a federated identity provider from the current user' })
  @ApiParam({ name: 'provider', description: 'Keycloak IdP alias (not local)' })
  async unlinkMyIdentity(@Param('provider') provider: string) {
    const data = await this.unlinkMyIdentityUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      provider,
    });
    return { data };
  }

  @Post('me/identity/verify-email')
  @RequirePermissions('users:update')
  @AuditAction('user.identity.verify_email', 'user')
  @ApiOperation({ summary: 'Send Keycloak VERIFY_EMAIL required-action email' })
  async verifyMyEmail() {
    const data = await this.requestMyEmailVerificationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data };
  }

  @Post('me/identity/reset-password')
  @RequirePermissions('users:update')
  @AuditAction('user.identity.reset_password', 'user')
  @ApiOperation({ summary: 'Send Keycloak UPDATE_PASSWORD required-action email' })
  async resetMyPassword() {
    const data = await this.requestMyPasswordResetUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data };
  }

  @Post('me/identity/phone/send-otp')
  @RequirePermissions('users:update')
  @AuditAction('user.identity.phone_send_otp', 'user')
  @ApiOperation({ summary: 'Send phone KYC OTP via WhatsApp (dry-run when WHATSAPP_OTP_ENABLED=false)' })
  @ApiJsonBody(SendPhoneVerificationDto)
  async sendPhoneOtp(@Body() dto: SendPhoneVerificationDto) {
    const data = await this.sendPhoneVerificationOtpUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      phoneE164: dto.phoneE164,
    });
    return { data };
  }

  @Post('me/identity/phone/verify-otp')
  @RequirePermissions('users:update')
  @AuditAction('user.identity.phone_verify_otp', 'user')
  @ApiOperation({ summary: 'Verify phone KYC OTP and set verification.phoneVerified' })
  @ApiJsonBody(VerifyPhoneVerificationDto)
  async verifyPhoneOtp(@Body() dto: VerifyPhoneVerificationDto) {
    const data = await this.verifyPhoneVerificationOtpUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      phoneE164: dto.phoneE164,
      code: dto.code,
    });
    return { data };
  }

  @Get('me/security')
  @RequirePermissions('users:read')
  @ApiOperation({
    summary: 'Self-service security overview (compat; prefer GET /users/me/identity)',
  })
  @ApiOkDataResponse(MySecurityOverviewDto)
  async getMySecurity(@Query() query: MySecurityQueryDto) {
    const data = await this.getMySecurityOverviewUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      redirectUri: query.redirectUri,
    });
    return { data };
  }

  @Delete('me/security/credentials/:credentialId')
  @RequirePermissions('users:update')
  @AuditAction('user.credential.delete', 'user')
  @ApiOperation({ summary: 'Remove an MFA/passkey credential for the current user' })
  @ApiParam({ name: 'credentialId' })
  async deleteMyCredential(@Param('credentialId') credentialId: string) {
    const data = await this.deleteMyCredentialUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      credentialId,
    });
    return { data };
  }

  @Get('me/memberships')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List organization memberships for the current user' })
  @ApiOkDataResponse(OrganizationMembershipResponseDto, true)
  async listMyMemberships(@Query() pagination: PaginationQueryDto) {
    const result = await this.listMyMembershipsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: pagination.page,
      limit: pagination.limit,
    });
    return { data: result.data, pagination: result.pagination };
  }

  @Get(':identityId')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Get user by Keycloak subject or application user id' })
  @ApiParam({
    name: 'identityId',
    description: 'Keycloak sub or application user id',
  })
  @ApiOkDataResponse(ApplicationUserResponseDto)
  @ApiResponse({ status: 403, type: ApiErrorResponseDto })
  async getUser(@Param('identityId') identityId: string) {
    const user = await this.getUserByIdentityUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      identityId,
    });
    return { data: user };
  }

  @Post(':identityId/suspend')
  @RequirePermissions('users:suspend')
  @AuditAction('user.suspend', 'user')
  @ApiOperation({ summary: 'Suspend user (app + Keycloak disable)' })
  @ApiOkDataResponse(ApplicationUserResponseDto)
  async suspend(@Param('identityId') identityId: string) {
    const user = await this.suspendUserUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      identityId,
    });
    return { data: user };
  }

  @Post(':identityId/disable')
  @RequirePermissions('users:suspend')
  @AuditAction('user.disable', 'user')
  @ApiOperation({ summary: 'Disable user (app + Keycloak disable)' })
  @ApiOkDataResponse(ApplicationUserResponseDto)
  async disable(@Param('identityId') identityId: string) {
    const user = await this.disableUserUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      identityId,
    });
    return { data: user };
  }

  @Post(':identityId/reactivate')
  @RequirePermissions('users:update')
  @AuditAction('user.reactivate', 'user')
  @ApiOperation({ summary: 'Reactivate suspended/disabled user' })
  @ApiOkDataResponse(ApplicationUserResponseDto)
  async reactivate(@Param('identityId') identityId: string) {
    const user = await this.reactivateUserUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      identityId,
    });
    return { data: user };
  }
}
