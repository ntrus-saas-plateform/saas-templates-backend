import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { SubscriptionTenantAssociationPort } from '../../domain/ports/subscription-tenant-association.port.js';
import {
  AssociationStatus,
  DEFAULT_ENVIRONMENT_SLOT,
  assertTerminalTransition,
  type CreateAssociationInput,
  type SubscriptionTenantAssociation,
} from '../../domain/subscription/subscription-tenant-association.js';

@Injectable()
export class PgSubscriptionTenantAssociationRepository
  implements SubscriptionTenantAssociationPort
{
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  private map(r: Record<string, unknown>): SubscriptionTenantAssociation {
    return {
      id: String(r.id),
      accountId: String(r.account_id),
      productId: String(r.product_id),
      productTenantId: String(r.product_tenant_id),
      productTenantRef: String(r.product_tenant_ref),
      subscriptionId: String(r.subscription_id),
      associationType: String(r.association_type),
      associationStatus: String(r.association_status),
      environmentSlot: String(r.environment_slot),
      effectiveFrom: new Date(String(r.effective_from)),
      effectiveUntil: r.effective_until ? new Date(String(r.effective_until)) : null,
      supersedesAssociationId: (r.supersedes_association_id as string | null) ?? null,
      sourceEventId: (r.source_event_id as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdBy: (r.created_by as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async create(input: CreateAssociationInput): Promise<SubscriptionTenantAssociation> {
    const status = input.associationStatus ?? AssociationStatus.PENDING;
    const slot = input.environmentSlot ?? DEFAULT_ENVIRONMENT_SLOT;
    const result = await this.pool.query(
      `INSERT INTO edge_subscription_tenant_associations (
         account_id, product_id, product_tenant_id, product_tenant_ref,
         subscription_id, association_type, association_status, environment_slot,
         effective_from, supersedes_association_id, source_event_id, correlation_id,
         metadata, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz, NOW()),$10,$11,$12,$13::jsonb,$14
       )
       RETURNING *`,
      [
        input.accountId,
        input.productId,
        input.productTenantId,
        input.productTenantRef,
        input.subscriptionId,
        input.associationType,
        status,
        slot,
        input.effectiveFrom ?? null,
        input.supersedesAssociationId ?? null,
        input.sourceEventId ?? null,
        input.correlationId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          input.createdBy,
        )
          ? input.createdBy
          : null,
      ],
    );
    return this.map(result.rows[0] as Record<string, unknown>);
  }

  async getById(id: string): Promise<SubscriptionTenantAssociation | null> {
    const result = await this.pool.query(
      `SELECT * FROM edge_subscription_tenant_associations WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.map(result.rows[0] as Record<string, unknown>) : null;
  }

  async listBySubscription(subscriptionId: string): Promise<SubscriptionTenantAssociation[]> {
    const result = await this.pool.query(
      `SELECT * FROM edge_subscription_tenant_associations
       WHERE subscription_id = $1
       ORDER BY created_at DESC`,
      [subscriptionId],
    );
    return result.rows.map((r) => this.map(r as Record<string, unknown>));
  }

  async getActiveBySubscription(
    subscriptionId: string,
  ): Promise<SubscriptionTenantAssociation | null> {
    const result = await this.pool.query(
      `SELECT * FROM edge_subscription_tenant_associations
       WHERE subscription_id = $1 AND association_status = 'ACTIVE'
       LIMIT 1`,
      [subscriptionId],
    );
    return result.rows[0] ? this.map(result.rows[0] as Record<string, unknown>) : null;
  }

  async getActiveByProductTenant(
    productTenantId: string,
    environmentSlot = DEFAULT_ENVIRONMENT_SLOT,
  ): Promise<SubscriptionTenantAssociation | null> {
    const result = await this.pool.query(
      `SELECT * FROM edge_subscription_tenant_associations
       WHERE product_tenant_id = $1
         AND environment_slot = $2
         AND association_status = 'ACTIVE'
       LIMIT 1`,
      [productTenantId, environmentSlot],
    );
    return result.rows[0] ? this.map(result.rows[0] as Record<string, unknown>) : null;
  }

  async transitionStatus(input: {
    id: string;
    toStatus: string;
    effectiveUntil?: Date | null;
    metadataPatch?: Record<string, unknown>;
  }): Promise<SubscriptionTenantAssociation> {
    const current = await this.getById(input.id);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Association not found');
    }
    assertTerminalTransition(current.associationStatus, input.toStatus);
    const result = await this.pool.query(
      `UPDATE edge_subscription_tenant_associations SET
         association_status = $2,
         effective_until = COALESCE($3::timestamptz, effective_until),
         metadata = metadata || COALESCE($4::jsonb, '{}'::jsonb),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        input.id,
        input.toStatus,
        input.effectiveUntil ?? null,
        input.metadataPatch ? JSON.stringify(input.metadataPatch) : null,
      ],
    );
    return this.map(result.rows[0] as Record<string, unknown>);
  }
}
