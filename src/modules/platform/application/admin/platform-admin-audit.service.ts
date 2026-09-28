import { Inject, Injectable } from '@nestjs/common';
import { PLATFORM_ADMIN_AUDIT_PORT } from '../../domain/ports/platform-admin-audit.port.js';
import type { PlatformAdminAuditPort, PlatformAdminAuditRecord } from '../../domain/ports/platform-admin-audit.port.js';

@Injectable()
export class PlatformAdminAuditService {
  constructor(
    @Inject(PLATFORM_ADMIN_AUDIT_PORT) private readonly auditPort: PlatformAdminAuditPort,
  ) {}

  async record(entry: PlatformAdminAuditRecord): Promise<void> {
    await this.auditPort.record(entry);
  }
}
