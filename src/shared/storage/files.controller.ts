import {
  Controller,
  Get,
  Inject,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { SwaggerTags } from '../swagger/swagger.constants.js';
import {
  FILE_STORAGE_PORT,
  type FileStoragePort,
} from '../../core/domain/ports/file-storage.port.js';
import { DomainError, ErrorCode } from '../../core/domain/errors/domain-error.js';
import { assertSafeStorageKey } from './storage-key.js';

@ApiTags(SwaggerTags.USERS)
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(
    private readonly tenantContext: TenantContextService,
    @Inject(FILE_STORAGE_PORT) private readonly storage: FileStoragePort,
  ) {}

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Download a tenant-scoped stored file (avatar, attachments)' })
  async getFile(@Query('key') key: string): Promise<StreamableFile> {
    assertSafeStorageKey(key);
    const ctx = this.tenantContext.getOrThrow();
    try {
      const file = await this.storage.read(ctx.tenantId, key);
      return new StreamableFile(file.body, {
        type: file.contentType,
        disposition: 'inline',
      });
    } catch {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'File not found');
    }
  }
}
