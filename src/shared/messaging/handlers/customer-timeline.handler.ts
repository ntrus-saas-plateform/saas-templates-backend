import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { IntegrationEventHandler } from '../../../core/domain/ports/integration-event-handler.port.js';
import type { IntegrationEvent } from '../../../core/domain/events/integration-event.js';
import { TenantDatabaseManager } from '../../database/tenant-database.manager.js';
import { LoggerService } from '../../logging/logger.service.js';

/** Legacy commerce payloads (module removed; keep timeline side-effects if events still arrive). */
type OrderMoneyPayload = {
  readonly orderId: string;
  readonly tenantCustomerId: string;
  readonly totalAmount: number;
  readonly loyaltyPointsEarned: number;
};

type SalesOrderTimelinePayload = {
  readonly orderId: string;
  readonly customerId: string;
  readonly grandTotal: number;
  readonly orderNumber?: string;
  readonly currency?: string;
};

function extractTenantCustomerId(event: IntegrationEvent): string | null {
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.tenantCustomerId === 'string') return payload.tenantCustomerId;
  if (typeof payload.survivorTenantCustomerId === 'string') return payload.survivorTenantCustomerId;
  if (typeof payload.customerId === 'string') return payload.customerId;
  return null;
}

function isAppendOnlyTimelineSource(eventType: string): boolean {
  return (
    eventType.startsWith('sales.') ||
    eventType.startsWith('loyalty.points.') ||
    eventType.startsWith('finance.') ||
    eventType.startsWith('crm.')
  );
}

@Injectable()
export class CustomerTimelineHandler implements IntegrationEventHandler {
  constructor(
    private readonly dbManager: TenantDatabaseManager,
    private readonly logger: LoggerService,
  ) {}

  supports(eventType: string): boolean {
    return (
      eventType.startsWith('customer.') ||
      eventType.startsWith('commerce.') ||
      isAppendOnlyTimelineSource(eventType)
    );
  }

  async handle(event: IntegrationEvent): Promise<void> {
    let tenantCustomerId = extractTenantCustomerId(event);

    // Resolve loyalty account → customer without writing to loyalty ledger.
    if (
      !tenantCustomerId &&
      event.eventType.startsWith('loyalty.points.') &&
      typeof (event.payload as Record<string, unknown>).accountId === 'string'
    ) {
      tenantCustomerId = await this.resolveLoyaltyCustomerId(
        event.tenantId,
        (event.payload as { accountId: string }).accountId,
      );
    }

    if (!tenantCustomerId) return;

    const pool = await this.dbManager.getPool(event.tenantId);
    const insertResult = await pool.query<{ id: string }>(
      `INSERT INTO customer_timeline_events (
         id, tenant_id, tenant_customer_id, organization_id, event_type, occurred_at,
         payload, correlation_id, source_event_id, source_domain
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (tenant_id, source_event_id) DO NOTHING
       RETURNING id`,
      [
        randomUUID(),
        event.tenantId,
        tenantCustomerId,
        event.organizationId,
        event.eventType,
        event.occurredAt,
        JSON.stringify(event.payload),
        event.correlationId,
        event.eventId,
        event.eventType.split('.')[0] ?? null,
      ],
    );

    if (!insertResult.rowCount) {
      this.logger.debug('Skipping duplicate timeline event', {
        eventId: event.eventId,
        eventType: event.eventType,
        tenantId: event.tenantId,
      });
      return;
    }

    // Sales path: CP purchase stats only (loyalty uses loyalty.points.* events).
    if (event.eventType === 'sales.order.completed.v1') {
      await this.applySalesOrderCompletedStats(event);
    } else if (event.eventType === 'sales.order.cancelled.v1') {
      await this.reverseSalesOrderStats(event);
    } else if (event.eventType === 'commerce.order.completed.v1') {
      await this.applyOrderCompletedSideEffects(event, pool);
    } else if (
      event.eventType === 'commerce.order.cancelled.v1' ||
      event.eventType === 'commerce.order.refunded.v1'
    ) {
      await this.reverseOrderSideEffects(event, pool);
    }

    this.logger.info('Customer timeline event recorded', {
      eventId: event.eventId,
      eventType: event.eventType,
      tenantId: event.tenantId,
      tenantCustomerId,
    });
  }

  private async resolveLoyaltyCustomerId(
    tenantId: string,
    accountId: string,
  ): Promise<string | null> {
    try {
      const pool = await this.dbManager.getPool(tenantId);
      const result = await pool.query<{ customer_id: string }>(
        `SELECT customer_id FROM loyalty_accounts WHERE id = $1`,
        [accountId],
      );
      return result.rows[0]?.customer_id ?? null;
    } catch {
      return null;
    }
  }

  private async applySalesOrderCompletedStats(event: IntegrationEvent): Promise<void> {
    const payload = event.payload as SalesOrderTimelinePayload;
    if (!payload.customerId || payload.grandTotal == null) return;
    const purchasedAt = new Date(event.occurredAt);
    const cp = this.dbManager.getControlPlanePool();
    await cp.query(
      `UPDATE tenant_customers
       SET total_orders = total_orders + 1,
           total_spent = total_spent + $3,
           first_purchase_at = CASE
             WHEN first_purchase_at IS NULL THEN $4
             ELSE LEAST(first_purchase_at, $4)
           END,
           last_purchase_at = CASE
             WHEN last_purchase_at IS NULL THEN $4
             ELSE GREATEST(last_purchase_at, $4)
           END,
           version = version + 1,
           updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [event.tenantId, payload.customerId, payload.grandTotal, purchasedAt],
    );
  }

  private async reverseSalesOrderStats(event: IntegrationEvent): Promise<void> {
    const payload = event.payload as SalesOrderTimelinePayload;
    if (!payload.customerId || payload.grandTotal == null) return;
    const cp = this.dbManager.getControlPlanePool();
    await cp.query(
      `UPDATE tenant_customers
       SET total_orders = GREATEST(total_orders - 1, 0),
           total_spent = GREATEST(total_spent - $3, 0),
           version = version + 1,
           updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [event.tenantId, payload.customerId, payload.grandTotal],
    );
  }

  private async applyOrderCompletedSideEffects(
    event: IntegrationEvent,
    tenantPool: Awaited<ReturnType<TenantDatabaseManager['getPool']>>,
  ): Promise<void> {
    const payload = event.payload as OrderMoneyPayload;
    const purchasedAt = new Date(event.occurredAt);
    const cp = this.dbManager.getControlPlanePool();

    await cp.query(
      `UPDATE tenant_customers
       SET total_orders = total_orders + 1,
           total_spent = total_spent + $3,
           first_purchase_at = CASE
             WHEN first_purchase_at IS NULL THEN $4
             ELSE LEAST(first_purchase_at, $4)
           END,
           last_purchase_at = CASE
             WHEN last_purchase_at IS NULL THEN $4
             ELSE GREATEST(last_purchase_at, $4)
           END,
           version = version + 1,
           updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [event.tenantId, payload.tenantCustomerId, payload.totalAmount, purchasedAt],
    );

    if (payload.loyaltyPointsEarned <= 0) return;

    const accountResult = await tenantPool.query<{ id: string }>(
      `SELECT id FROM loyalty_accounts
       WHERE tenant_id = $1 AND tenant_customer_id = $2`,
      [event.tenantId, payload.tenantCustomerId],
    );

    let accountId = accountResult.rows[0]?.id;
    if (!accountId) {
      accountId = randomUUID();
      await tenantPool.query(
        `INSERT INTO loyalty_accounts (id, tenant_id, tenant_customer_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [accountId, event.tenantId, payload.tenantCustomerId],
      );
      const again = await tenantPool.query<{ id: string }>(
        `SELECT id FROM loyalty_accounts
         WHERE tenant_id = $1 AND tenant_customer_id = $2`,
        [event.tenantId, payload.tenantCustomerId],
      );
      accountId = again.rows[0]?.id ?? accountId;
    }

    await tenantPool.query(
      `UPDATE loyalty_accounts
       SET points_balance = points_balance + $3, version = version + 1, updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [event.tenantId, accountId, payload.loyaltyPointsEarned],
    );

    await tenantPool.query(
      `INSERT INTO loyalty_transactions (id, tenant_id, loyalty_account_id, type, points, order_id)
       VALUES ($1, $2, $3, 'EARN', $4, $5)`,
      [
        randomUUID(),
        event.tenantId,
        accountId,
        payload.loyaltyPointsEarned,
        payload.orderId,
      ],
    );
  }

  private async reverseOrderSideEffects(
    event: IntegrationEvent,
    tenantPool: Awaited<ReturnType<TenantDatabaseManager['getPool']>>,
  ): Promise<void> {
    const payload = event.payload as OrderMoneyPayload;
    const cp = this.dbManager.getControlPlanePool();

    await cp.query(
      `UPDATE tenant_customers
       SET total_orders = GREATEST(total_orders - 1, 0),
           total_spent = GREATEST(total_spent - $3, 0),
           version = version + 1,
           updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [event.tenantId, payload.tenantCustomerId, payload.totalAmount],
    );

    if (payload.loyaltyPointsEarned <= 0) return;

    const accountResult = await tenantPool.query<{ id: string }>(
      `SELECT id FROM loyalty_accounts
       WHERE tenant_id = $1 AND tenant_customer_id = $2`,
      [event.tenantId, payload.tenantCustomerId],
    );
    const accountId = accountResult.rows[0]?.id;
    if (!accountId) return;

    await tenantPool.query(
      `UPDATE loyalty_accounts
       SET points_balance = GREATEST(points_balance - $3, 0),
           version = version + 1,
           updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [event.tenantId, accountId, payload.loyaltyPointsEarned],
    );

    await tenantPool.query(
      `INSERT INTO loyalty_transactions (id, tenant_id, loyalty_account_id, type, points, order_id)
       VALUES ($1, $2, $3, 'ADJUST', $4, $5)`,
      [
        randomUUID(),
        event.tenantId,
        accountId,
        -payload.loyaltyPointsEarned,
        payload.orderId,
      ],
    );
  }
}
