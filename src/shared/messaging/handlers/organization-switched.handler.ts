import { Injectable } from '@nestjs/common';
import type { IntegrationEventHandler } from '../../../core/domain/ports/integration-event-handler.port.js';
import type { IntegrationEvent } from '../../../core/domain/events/integration-event.js';
import type { OrganizationSwitchedPayload } from '../../../core/domain/events/organization-switched.event.js';
import { TenantDatabaseManager } from '../../database/tenant-database.manager.js';
import { LoggerService } from '../../logging/logger.service.js';

@Injectable()
export class OrganizationSwitchedHandler implements IntegrationEventHandler {
  constructor(
    private readonly dbManager: TenantDatabaseManager,
    private readonly logger: LoggerService,
  ) {}

  supports(eventType: string): boolean {
    return eventType === 'platform.organization.switched.v1';
  }

  async handle(event: IntegrationEvent): Promise<void> {
    const payload = event.payload as OrganizationSwitchedPayload;
    const pool = await this.dbManager.getPool(event.tenantId);

    await pool.query(
      `INSERT INTO integration_event_log (event_id, event_type, payload, processed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (event_id) DO NOTHING`,
      [event.eventId, event.eventType, JSON.stringify(payload)],
    );

    this.logger.info('Organization switched event persisted', {
      eventId: event.eventId,
      tenantId: event.tenantId,
      organizationId: payload.organizationId,
      userId: payload.userId,
    });
  }
}
