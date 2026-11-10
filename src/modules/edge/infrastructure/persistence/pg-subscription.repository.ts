import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  BillingCoordination,
  Cancellation,
  ChangeRequest,
  EdgeSubscription,
  EntitlementPublication,
  EntitlementSnapshot,
  LifecycleEvent,
  OverviewStats,
  ProvisioningRequest,
  Renewal,
  StatusHistory,
  SubscriptionItem,
  SubscriptionListResult,
  SubscriptionPeriod,
  ScheduledChange,
  SubscriptionApproval,
  SubscriptionPolicy,
  SubscriptionRepositoryPort,
  Suspension,
  Trial,
} from '../../domain/ports/subscription-repository.port.js';

@Injectable()
export class PgSubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  private async q<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(sql, params);
    return result.rows;
  }

  private mapSubscription(r: Record<string, unknown>): EdgeSubscription {
    return {
      id: String(r.id),
      subscriptionNumber: String(r.subscription_number),
      accountId: String(r.account_id),
      contractId: (r.contract_id as string | null) ?? null,
      salesOrderId: (r.sales_order_id as string | null) ?? null,
      handoffId: (r.handoff_id as string | null) ?? null,
      productId: String(r.product_id),
      verticalId: (r.vertical_id as string | null) ?? null,
      marketId: (r.market_id as string | null) ?? null,
      packageId: (r.package_id as string | null) ?? null,
      planId: (r.plan_id as string | null) ?? null,
      planVersion: r.plan_version == null ? null : Number(r.plan_version),
      status: String(r.status),
      subscriptionType: String(r.subscription_type),
      billingFrequency: (r.billing_frequency as string | null) ?? null,
      currency: String(r.currency),
      startAt: r.start_at ? new Date(String(r.start_at)) : null,
      endAt: r.end_at ? new Date(String(r.end_at)) : null,
      currentPeriodStart: r.current_period_start
        ? new Date(String(r.current_period_start))
        : null,
      currentPeriodEnd: r.current_period_end ? new Date(String(r.current_period_end)) : null,
      renewalAt: r.renewal_at ? new Date(String(r.renewal_at)) : null,
      trialStartAt: r.trial_start_at ? new Date(String(r.trial_start_at)) : null,
      trialEndAt: r.trial_end_at ? new Date(String(r.trial_end_at)) : null,
      billingReference: (r.billing_reference as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      commercialValidated: Boolean(r.commercial_validated),
      provisioningRequired: Boolean(r.provisioning_required),
      provisioningConfirmed: Boolean(r.provisioning_confirmed),
      billingRequired: Boolean(r.billing_required),
      billingConfirmed: Boolean(r.billing_confirmed),
      enterpriseProfile: (r.enterprise_profile as Record<string, unknown>) ?? {},
      commercialSnapshot: (r.commercial_snapshot as Record<string, unknown>) ?? {},
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdBy: (r.created_by as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapItem(r: Record<string, unknown>): SubscriptionItem {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      itemType: String(r.item_type),
      productId: (r.product_id as string | null) ?? null,
      offerRef: (r.offer_ref as string | null) ?? null,
      version: r.version == null ? null : Number(r.version),
      quantity: String(r.quantity),
      unit: (r.unit as string | null) ?? null,
      status: String(r.status),
      pricingRef: (r.pricing_ref as string | null) ?? null,
      entitlementRef: (r.entitlement_ref as string | null) ?? null,
      startAt: r.start_at ? new Date(String(r.start_at)) : null,
      endAt: r.end_at ? new Date(String(r.end_at)) : null,
      snapshot: (r.snapshot as Record<string, unknown>) ?? {},
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapPeriod(r: Record<string, unknown>): SubscriptionPeriod {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      periodNumber: Number(r.period_number),
      startsAt: new Date(String(r.starts_at)),
      endsAt: new Date(String(r.ends_at)),
      status: String(r.status),
      billingFrequency: (r.billing_frequency as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapStatusHistory(r: Record<string, unknown>): StatusHistory {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      fromStatus: (r.from_status as string | null) ?? null,
      toStatus: String(r.to_status),
      reason: (r.reason as string | null) ?? null,
      actorId: (r.actor_id as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapLifecycle(r: Record<string, unknown>): LifecycleEvent {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      eventType: String(r.event_type),
      payload: (r.payload as Record<string, unknown>) ?? {},
      actorId: (r.actor_id as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapSnapshot(r: Record<string, unknown>): EntitlementSnapshot {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      version: Number(r.version),
      periodId: (r.period_id as string | null) ?? null,
      entitlements: (r.entitlements as Record<string, unknown>) ?? {},
      sourceOfferVersions: (r.source_offer_versions as Record<string, unknown>) ?? {},
      calculationVersion: (r.calculation_version as string | null) ?? null,
      reason: (r.reason as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      validFrom: new Date(String(r.valid_from)),
      validUntil: r.valid_until ? new Date(String(r.valid_until)) : null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapPublication(r: Record<string, unknown>): EntitlementPublication {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      snapshotId: String(r.snapshot_id),
      status: String(r.status),
      externalAck: (r.external_ack as string | null) ?? null,
      failureMessage: (r.failure_message as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      publishedAt: r.published_at ? new Date(String(r.published_at)) : null,
    };
  }

  private mapChange(r: Record<string, unknown>): ChangeRequest {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      changeType: String(r.change_type),
      currentConfig: (r.current_config as Record<string, unknown>) ?? {},
      proposedConfig: (r.proposed_config as Record<string, unknown>) ?? {},
      requestedEffectiveAt: r.requested_effective_at
        ? new Date(String(r.requested_effective_at))
        : null,
      requestedBy: (r.requested_by as string | null) ?? null,
      reason: (r.reason as string | null) ?? null,
      approvalStatus: String(r.approval_status),
      pricingImpact: (r.pricing_impact as Record<string, unknown>) ?? {},
      entitlementImpact: (r.entitlement_impact as Record<string, unknown>) ?? {},
      billingImpactRef: (r.billing_impact_ref as string | null) ?? null,
      provisioningImpact: (r.provisioning_impact as Record<string, unknown>) ?? {},
      executionStatus: String(r.execution_status),
      correlationId: (r.correlation_id as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapRenewal(r: Record<string, unknown>): Renewal {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      renewalStatus: String(r.renewal_status),
      offeredAt: r.offered_at ? new Date(String(r.offered_at)) : null,
      dueAt: r.due_at ? new Date(String(r.due_at)) : null,
      renewedPeriodStart: r.renewed_period_start
        ? new Date(String(r.renewed_period_start))
        : null,
      renewedPeriodEnd: r.renewed_period_end ? new Date(String(r.renewed_period_end)) : null,
      failureMessage: (r.failure_message as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapTrial(r: Record<string, unknown>): Trial {
    return {
      id: String(r.id),
      subscriptionId: (r.subscription_id as string | null) ?? null,
      accountId: String(r.account_id),
      productId: String(r.product_id),
      packageId: (r.package_id as string | null) ?? null,
      status: String(r.status),
      startAt: r.start_at ? new Date(String(r.start_at)) : null,
      endAt: r.end_at ? new Date(String(r.end_at)) : null,
      durationDays: r.duration_days == null ? null : Number(r.duration_days),
      trialEntitlements: (r.trial_entitlements as Record<string, unknown>) ?? {},
      restrictions: (r.restrictions as Record<string, unknown>) ?? {},
      conversionSubscriptionId: (r.conversion_subscription_id as string | null) ?? null,
      ownerAdministratorId: (r.owner_administrator_id as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapSuspension(r: Record<string, unknown>): Suspension {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      reason: String(r.reason),
      reasonDetail: (r.reason_detail as string | null) ?? null,
      requestedBy: (r.requested_by as string | null) ?? null,
      approvedBy: (r.approved_by as string | null) ?? null,
      effectiveAt: new Date(String(r.effective_at)),
      liftedAt: r.lifted_at ? new Date(String(r.lifted_at)) : null,
      status: String(r.status),
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapCancellation(r: Record<string, unknown>): Cancellation {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      reason: String(r.reason),
      noticeDays: r.notice_days == null ? null : Number(r.notice_days),
      effectiveAt: r.effective_at ? new Date(String(r.effective_at)) : null,
      requestedBy: (r.requested_by as string | null) ?? null,
      approvedBy: (r.approved_by as string | null) ?? null,
      status: String(r.status),
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapBilling(r: Record<string, unknown>): BillingCoordination {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      outcome: String(r.outcome),
      billingAccountRef: (r.billing_account_ref as string | null) ?? null,
      payload: (r.payload as Record<string, unknown>) ?? {},
      externalRef: (r.external_ref as string | null) ?? null,
      failureMessage: (r.failure_message as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      confirmedAt: r.confirmed_at ? new Date(String(r.confirmed_at)) : null,
    };
  }

  private mapProvisioning(r: Record<string, unknown>): ProvisioningRequest {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      outcome: String(r.outcome),
      tenantRef: (r.tenant_ref as string | null) ?? null,
      payload: (r.payload as Record<string, unknown>) ?? {},
      externalRef: (r.external_ref as string | null) ?? null,
      failureMessage: (r.failure_message as string | null) ?? null,
      correlationId: String(r.correlation_id),
      createdAt: new Date(String(r.created_at)),
      completedAt: r.completed_at ? new Date(String(r.completed_at)) : null,
    };
  }

  private mapPolicy(r: Record<string, unknown>): SubscriptionPolicy {
    return {
      id: String(r.id),
      code: String(r.code),
      policyType: String(r.policy_type),
      rules: (r.rules as Record<string, unknown>) ?? {},
      status: String(r.status),
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapApproval(r: Record<string, unknown>): SubscriptionApproval {
    return {
      id: String(r.id),
      subscriptionId: (r.subscription_id as string | null) ?? null,
      changeRequestId: (r.change_request_id as string | null) ?? null,
      approvalType: String(r.approval_type),
      status: String(r.status),
      requestedBy: (r.requested_by as string | null) ?? null,
      decisionBy: (r.decision_by as string | null) ?? null,
      decisionNote: (r.decision_note as string | null) ?? null,
      decidedAt: r.decided_at ? new Date(String(r.decided_at)) : null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapScheduledChange(r: Record<string, unknown>): ScheduledChange {
    return {
      id: String(r.id),
      changeRequestId: String(r.change_request_id),
      executeAt: new Date(String(r.execute_at)),
      status: String(r.status),
      cancelledAt: r.cancelled_at ? new Date(String(r.cancelled_at)) : null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  async createSubscription(input: Parameters<SubscriptionRepositoryPort['createSubscription']>[0]) {
    if (input.correlationId) {
      const existing = await this.getByCorrelationId(input.correlationId);
      if (existing) return existing;
    }

    const rows = await this.q(
      `INSERT INTO edge_subscriptions (
         subscription_number, account_id, contract_id, sales_order_id, handoff_id,
         product_id, vertical_id, market_id, package_id, plan_id, plan_version,
         status, subscription_type, billing_frequency, currency, correlation_id,
         commercial_validated, provisioning_required, billing_required,
         enterprise_profile, commercial_snapshot, metadata, created_by
       ) VALUES (
         'SUB-' || nextval('edge_subscription_number_seq'),
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         COALESCE($11, 'DRAFT'), COALESCE($12, 'STANDARD'), $13, COALESCE($14, 'USD'), $15,
         COALESCE($16, FALSE), COALESCE($17, TRUE), COALESCE($18, FALSE),
         COALESCE($19, '{}'::jsonb), COALESCE($20, '{}'::jsonb), COALESCE($21, '{}'::jsonb), $22
       )
       ON CONFLICT (correlation_id) DO NOTHING
       RETURNING *`,
      [
        input.accountId,
        input.contractId ?? null,
        input.salesOrderId ?? null,
        input.handoffId ?? null,
        input.productId,
        input.verticalId ?? null,
        input.marketId ?? null,
        input.packageId ?? null,
        input.planId ?? null,
        input.planVersion ?? null,
        input.status ?? 'DRAFT',
        input.subscriptionType ?? 'STANDARD',
        input.billingFrequency ?? null,
        input.currency ?? 'USD',
        input.correlationId ?? null,
        input.commercialValidated ?? false,
        input.provisioningRequired ?? true,
        input.billingRequired ?? false,
        JSON.stringify(input.enterpriseProfile ?? {}),
        JSON.stringify(input.commercialSnapshot ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy ?? null,
      ],
    );

    if (!rows.length && input.correlationId) {
      const existing = await this.getByCorrelationId(input.correlationId);
      if (existing) return existing;
    }
    if (!rows[0]) {
      throw new Error('Failed to create subscription');
    }
    return this.mapSubscription(rows[0]);
  }

  async getById(id: string) {
    const rows = await this.q(`SELECT * FROM edge_subscriptions WHERE id = $1`, [id]);
    return rows[0] ? this.mapSubscription(rows[0]) : null;
  }

  async getByCorrelationId(correlationId: string) {
    const rows = await this.q(`SELECT * FROM edge_subscriptions WHERE correlation_id = $1`, [
      correlationId,
    ]);
    return rows[0] ? this.mapSubscription(rows[0]) : null;
  }

  async listSubscriptions(opts?: Parameters<SubscriptionRepositoryPort['listSubscriptions']>[0]) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (opts?.accountId) {
      clauses.push(`account_id = $${idx++}`);
      params.push(opts.accountId);
    }
    if (opts?.productId) {
      clauses.push(`product_id = $${idx++}`);
      params.push(opts.productId);
    }
    if (opts?.status) {
      clauses.push(`status = $${idx++}`);
      params.push(opts.status);
    }
    if (opts?.handoffId) {
      clauses.push(`handoff_id = $${idx++}`);
      params.push(opts.handoffId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countRows = await this.q<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM edge_subscriptions ${where}`,
      params,
    );
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const rows = await this.q(
      `SELECT * FROM edge_subscriptions ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );
    return {
      items: rows.map((r) => this.mapSubscription(r)),
      total: Number(countRows[0]?.count ?? 0),
    } satisfies SubscriptionListResult;
  }

  async updateSubscription(
    id: string,
    patch: Parameters<SubscriptionRepositoryPort['updateSubscription']>[1],
  ) {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;
    const add = (col: string, val: unknown) => {
      sets.push(`${col} = $${idx++}`);
      params.push(val);
    };
    if (patch.status !== undefined) add('status', patch.status);
    if (patch.planId !== undefined) add('plan_id', patch.planId);
    if (patch.packageId !== undefined) add('package_id', patch.packageId);
    if (patch.billingFrequency !== undefined) add('billing_frequency', patch.billingFrequency);
    if (patch.currency !== undefined) add('currency', patch.currency);
    if (patch.startAt !== undefined) add('start_at', patch.startAt);
    if (patch.endAt !== undefined) add('end_at', patch.endAt);
    if (patch.currentPeriodStart !== undefined) add('current_period_start', patch.currentPeriodStart);
    if (patch.currentPeriodEnd !== undefined) add('current_period_end', patch.currentPeriodEnd);
    if (patch.renewalAt !== undefined) add('renewal_at', patch.renewalAt);
    if (patch.trialStartAt !== undefined) add('trial_start_at', patch.trialStartAt);
    if (patch.trialEndAt !== undefined) add('trial_end_at', patch.trialEndAt);
    if (patch.commercialValidated !== undefined) add('commercial_validated', patch.commercialValidated);
    if (patch.provisioningConfirmed !== undefined)
      add('provisioning_confirmed', patch.provisioningConfirmed);
    if (patch.billingConfirmed !== undefined) add('billing_confirmed', patch.billingConfirmed);
    if (patch.enterpriseProfile !== undefined)
      add('enterprise_profile', JSON.stringify(patch.enterpriseProfile));
    if (patch.commercialSnapshot !== undefined)
      add('commercial_snapshot', JSON.stringify(patch.commercialSnapshot));
    if (patch.metadata !== undefined) add('metadata', JSON.stringify(patch.metadata));
    params.push(id);
    const rows = await this.q(
      `UPDATE edge_subscriptions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return this.mapSubscription(rows[0]!);
  }

  async appendStatusHistory(input: Parameters<SubscriptionRepositoryPort['appendStatusHistory']>[0]) {
    const rows = await this.q(
      `INSERT INTO edge_subscription_status_history
         (subscription_id, from_status, to_status, reason, actor_id, correlation_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.subscriptionId,
        input.fromStatus ?? null,
        input.toStatus,
        input.reason ?? null,
        input.actorId ?? null,
        input.correlationId ?? null,
      ],
    );
    return this.mapStatusHistory(rows[0]!);
  }

  async appendLifecycleEvent(input: Parameters<SubscriptionRepositoryPort['appendLifecycleEvent']>[0]) {
    const rows = await this.q(
      `INSERT INTO edge_subscription_lifecycle_events
         (subscription_id, event_type, payload, actor_id, correlation_id)
       VALUES ($1, $2, COALESCE($3, '{}'::jsonb), $4, $5)
       RETURNING *`,
      [
        input.subscriptionId,
        input.eventType,
        JSON.stringify(input.payload ?? {}),
        input.actorId ?? null,
        input.correlationId ?? null,
      ],
    );
    return this.mapLifecycle(rows[0]!);
  }

  async listStatusHistory(subscriptionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_subscription_status_history WHERE subscription_id = $1 ORDER BY created_at DESC`,
      [subscriptionId],
    );
    return rows.map((r) => this.mapStatusHistory(r));
  }

  async listLifecycleEvents(subscriptionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_subscription_lifecycle_events WHERE subscription_id = $1 ORDER BY created_at DESC`,
      [subscriptionId],
    );
    return rows.map((r) => this.mapLifecycle(r));
  }

  async addItem(input: Parameters<SubscriptionRepositoryPort['addItem']>[0]) {
    const rows = await this.q(
      `INSERT INTO edge_subscription_items
         (subscription_id, item_type, product_id, offer_ref, version, quantity, unit, status,
          pricing_ref, entitlement_ref, start_at, end_at, snapshot, metadata)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 1), $7, COALESCE($8, 'ACTIVE'),
               $9, $10, $11, $12, COALESCE($13, '{}'::jsonb), COALESCE($14, '{}'::jsonb))
       RETURNING *`,
      [
        input.subscriptionId,
        input.itemType,
        input.productId ?? null,
        input.offerRef ?? null,
        input.version ?? null,
        input.quantity ?? 1,
        input.unit ?? null,
        input.status ?? 'ACTIVE',
        input.pricingRef ?? null,
        input.entitlementRef ?? null,
        input.startAt ?? null,
        input.endAt ?? null,
        JSON.stringify(input.snapshot ?? {}),
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return this.mapItem(rows[0]!);
  }

  async listItems(subscriptionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_subscription_items WHERE subscription_id = $1 ORDER BY created_at`,
      [subscriptionId],
    );
    return rows.map((r) => this.mapItem(r));
  }

  async updateItemStatus(itemId: string, status: string, endAt?: Date | null) {
    const rows = await this.q(
      `UPDATE edge_subscription_items
       SET status = $2, end_at = COALESCE($3, end_at), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [itemId, status, endAt ?? null],
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription item not found');
    }
    return this.mapItem(rows[0]);
  }

  async createPeriod(input: Parameters<SubscriptionRepositoryPort['createPeriod']>[0]) {
    const rows = await this.q(
      `INSERT INTO edge_subscription_periods
         (subscription_id, period_number, starts_at, ends_at, status, billing_frequency)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'OPEN'), $6)
       RETURNING *`,
      [
        input.subscriptionId,
        input.periodNumber,
        input.startsAt,
        input.endsAt,
        input.status ?? 'OPEN',
        input.billingFrequency ?? null,
      ],
    );
    return this.mapPeriod(rows[0]!);
  }

  async listPeriods(subscriptionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_subscription_periods WHERE subscription_id = $1 ORDER BY period_number`,
      [subscriptionId],
    );
    return rows.map((r) => this.mapPeriod(r));
  }

  async createEntitlementSnapshot(
    input: Parameters<SubscriptionRepositoryPort['createEntitlementSnapshot']>[0],
  ) {
    const versionRows = await this.q<{ next: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next FROM edge_entitlement_snapshots WHERE subscription_id = $1`,
      [input.subscriptionId],
    );
    const version = versionRows[0]?.next ?? 1;
  const entJson =
      'resolved' in input.entitlements
        ? { resolved: input.entitlements.resolved }
        : input.entitlements;
    const rows = await this.q(
      `INSERT INTO edge_entitlement_snapshots
         (subscription_id, version, period_id, entitlements, source_offer_versions,
          calculation_version, reason, correlation_id)
       VALUES ($1, $2, $3, COALESCE($4, '{}'::jsonb), COALESCE($5, '{}'::jsonb), $6, $7, $8)
       RETURNING *`,
      [
        input.subscriptionId,
        version,
        input.periodId ?? null,
        JSON.stringify(entJson),
        JSON.stringify(input.sourceOfferVersions ?? {}),
        input.calculationVersion ?? null,
        input.reason ?? null,
        input.correlationId ?? null,
      ],
    );
    return this.mapSnapshot(rows[0]!);
  }

  async listSnapshots(subscriptionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_entitlement_snapshots WHERE subscription_id = $1 ORDER BY version DESC`,
      [subscriptionId],
    );
    return rows.map((r) => this.mapSnapshot(r));
  }

  async getLatestSnapshot(subscriptionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_entitlement_snapshots WHERE subscription_id = $1 ORDER BY version DESC LIMIT 1`,
      [subscriptionId],
    );
    return rows[0] ? this.mapSnapshot(rows[0]) : null;
  }

  async createPublication(input: Parameters<SubscriptionRepositoryPort['createPublication']>[0]) {
    const rows = await this.q(
      `INSERT INTO edge_entitlement_publications
         (subscription_id, snapshot_id, status, correlation_id)
       VALUES ($1, $2, COALESCE($3, 'REQUESTED'), $4)
       RETURNING *`,
      [input.subscriptionId, input.snapshotId, input.status ?? 'REQUESTED', input.correlationId ?? null],
    );
    return this.mapPublication(rows[0]!);
  }

  async updatePublication(
    id: string,
    patch: Parameters<SubscriptionRepositoryPort['updatePublication']>[1],
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (patch.status !== undefined) {
      sets.push(`status = $${idx++}`);
      params.push(patch.status);
    }
    if (patch.externalAck !== undefined) {
      sets.push(`external_ack = $${idx++}`);
      params.push(patch.externalAck);
    }
    if (patch.failureMessage !== undefined) {
      sets.push(`failure_message = $${idx++}`);
      params.push(patch.failureMessage);
    }
    if (patch.publishedAt !== undefined) {
      sets.push(`published_at = $${idx++}`);
      params.push(patch.publishedAt);
    }
    if (!sets.length) {
      const rows = await this.q(`SELECT * FROM edge_entitlement_publications WHERE id = $1`, [id]);
      return this.mapPublication(rows[0]!);
    }
    params.push(id);
    const rows = await this.q(
      `UPDATE edge_entitlement_publications SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return this.mapPublication(rows[0]!);
  }

  async listPublications(subscriptionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_entitlement_publications WHERE subscription_id = $1 ORDER BY created_at DESC`,
      [subscriptionId],
    );
    return rows.map((r) => this.mapPublication(r));
  }

  async createChangeRequest(input: Parameters<SubscriptionRepositoryPort['createChangeRequest']>[0]) {
    const rows = await this.q(
      `INSERT INTO edge_subscription_change_requests
         (subscription_id, change_type, current_config, proposed_config, requested_effective_at,
          requested_by, reason, approval_status, pricing_impact, entitlement_impact,
          billing_impact_ref, provisioning_impact, correlation_id)
       VALUES ($1, $2, COALESCE($3, '{}'::jsonb), COALESCE($4, '{}'::jsonb), $5,
               $6, $7, COALESCE($8, 'PENDING'), COALESCE($9, '{}'::jsonb), COALESCE($10, '{}'::jsonb),
               $11, COALESCE($12, '{}'::jsonb), $13)
       RETURNING *`,
      [
        input.subscriptionId,
        input.changeType,
        JSON.stringify(input.currentConfig ?? {}),
        JSON.stringify(input.proposedConfig ?? {}),
        input.requestedEffectiveAt ?? null,
        input.requestedBy ?? null,
        input.reason ?? null,
        input.approvalStatus ?? 'PENDING',
        JSON.stringify(input.pricingImpact ?? {}),
        JSON.stringify(input.entitlementImpact ?? {}),
        input.billingImpactRef ?? null,
        JSON.stringify(input.provisioningImpact ?? {}),
        input.correlationId ?? null,
      ],
    );
    return this.mapChange(rows[0]!);
  }

  async listChangeRequests(subscriptionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_subscription_change_requests WHERE subscription_id = $1 ORDER BY created_at DESC`,
      [subscriptionId],
    );
    return rows.map((r) => this.mapChange(r));
  }

  async getChangeRequest(id: string) {
    const rows = await this.q(`SELECT * FROM edge_subscription_change_requests WHERE id = $1`, [id]);
    return rows[0] ? this.mapChange(rows[0]) : null;
  }

  async updateChangeRequest(
    id: string,
    patch: Parameters<SubscriptionRepositoryPort['updateChangeRequest']>[1],
  ) {
    const sets = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;
    if (patch.approvalStatus !== undefined) {
      sets.push(`approval_status = $${idx++}`);
      params.push(patch.approvalStatus);
    }
    if (patch.executionStatus !== undefined) {
      sets.push(`execution_status = $${idx++}`);
      params.push(patch.executionStatus);
    }
    if (patch.proposedConfig !== undefined) {
      sets.push(`proposed_config = $${idx++}`);
      params.push(JSON.stringify(patch.proposedConfig));
    }
    params.push(id);
    const rows = await this.q(
      `UPDATE edge_subscription_change_requests SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return this.mapChange(rows[0]!);
  }

  async createRenewal(input: Parameters<SubscriptionRepositoryPort['createRenewal']>[0]) {
    const rows = await this.q(
      `INSERT INTO edge_subscription_renewals
         (subscription_id, renewal_status, offered_at, due_at, renewed_period_start,
          renewed_period_end, metadata)
       VALUES ($1, COALESCE($2, 'OFFERED'), $3, $4, $5, $6, COALESCE($7, '{}'::jsonb))
       RETURNING *`,
      [
        input.subscriptionId,
        input.renewalStatus ?? 'OFFERED',
        input.offeredAt ?? null,
        input.dueAt ?? null,
        input.renewedPeriodStart ?? null,
        input.renewedPeriodEnd ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return this.mapRenewal(rows[0]!);
  }

  async listRenewals(subscriptionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_subscription_renewals WHERE subscription_id = $1 ORDER BY created_at DESC`,
      [subscriptionId],
    );
    return rows.map((r) => this.mapRenewal(r));
  }

  async updateRenewal(
    id: string,
    patch: Parameters<SubscriptionRepositoryPort['updateRenewal']>[1],
  ) {
    const sets = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;
    if (patch.renewalStatus !== undefined) {
      sets.push(`renewal_status = $${idx++}`);
      params.push(patch.renewalStatus);
    }
    if (patch.renewedPeriodStart !== undefined) {
      sets.push(`renewed_period_start = $${idx++}`);
      params.push(patch.renewedPeriodStart);
    }
    if (patch.renewedPeriodEnd !== undefined) {
      sets.push(`renewed_period_end = $${idx++}`);
      params.push(patch.renewedPeriodEnd);
    }
    if (patch.failureMessage !== undefined) {
      sets.push(`failure_message = $${idx++}`);
      params.push(patch.failureMessage);
    }
    if (patch.metadata !== undefined) {
      sets.push(`metadata = $${idx++}`);
      params.push(JSON.stringify(patch.metadata));
    }
    params.push(id);
    const rows = await this.q(
      `UPDATE edge_subscription_renewals SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return this.mapRenewal(rows[0]!);
  }

  async createTrial(input: Parameters<SubscriptionRepositoryPort['createTrial']>[0]) {
    const rows = await this.q(
      `INSERT INTO edge_subscription_trials
         (subscription_id, account_id, product_id, package_id, status, start_at, end_at,
          duration_days, trial_entitlements, restrictions, owner_administrator_id, metadata)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'PENDING'), $6, $7, $8,
               COALESCE($9, '{}'::jsonb), COALESCE($10, '{}'::jsonb), $11, COALESCE($12, '{}'::jsonb))
       RETURNING *`,
      [
        input.subscriptionId ?? null,
        input.accountId,
        input.productId,
        input.packageId ?? null,
        input.status ?? 'PENDING',
        input.startAt ?? null,
        input.endAt ?? null,
        input.durationDays ?? null,
        JSON.stringify(input.trialEntitlements ?? {}),
        JSON.stringify(input.restrictions ?? {}),
        input.ownerAdministratorId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return this.mapTrial(rows[0]!);
  }

  async getTrialById(id: string) {
    const rows = await this.q(`SELECT * FROM edge_subscription_trials WHERE id = $1`, [id]);
    return rows[0] ? this.mapTrial(rows[0]) : null;
  }

  async listTrials(opts?: Parameters<SubscriptionRepositoryPort['listTrials']>[0]) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (opts?.accountId) {
      clauses.push(`account_id = $${idx++}`);
      params.push(opts.accountId);
    }
    if (opts?.subscriptionId) {
      clauses.push(`subscription_id = $${idx++}`);
      params.push(opts.subscriptionId);
    }
    if (opts?.status) {
      clauses.push(`status = $${idx++}`);
      params.push(opts.status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = opts?.limit ?? 50;
    const rows = await this.q(
      `SELECT * FROM edge_subscription_trials ${where} ORDER BY created_at DESC LIMIT $${idx++}`,
      [...params, limit],
    );
    return rows.map((r) => this.mapTrial(r));
  }

  async updateTrial(id: string, patch: Parameters<SubscriptionRepositoryPort['updateTrial']>[1]) {
    const sets = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;
    if (patch.status !== undefined) {
      sets.push(`status = $${idx++}`);
      params.push(patch.status);
    }
    if (patch.endAt !== undefined) {
      sets.push(`end_at = $${idx++}`);
      params.push(patch.endAt);
    }
    if (patch.conversionSubscriptionId !== undefined) {
      sets.push(`conversion_subscription_id = $${idx++}`);
      params.push(patch.conversionSubscriptionId);
    }
    if (patch.subscriptionId !== undefined) {
      sets.push(`subscription_id = $${idx++}`);
      params.push(patch.subscriptionId);
    }
    params.push(id);
    const rows = await this.q(
      `UPDATE edge_subscription_trials SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return this.mapTrial(rows[0]!);
  }

  async listSuspensions(subscriptionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_subscription_suspensions WHERE subscription_id = $1 ORDER BY effective_at DESC`,
      [subscriptionId],
    );
    return rows.map((r) => this.mapSuspension(r));
  }

  async updateSuspension(
    id: string,
    patch: Parameters<SubscriptionRepositoryPort['updateSuspension']>[1],
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (patch.status !== undefined) {
      sets.push(`status = $${idx++}`);
      params.push(patch.status);
    }
    if (patch.liftedAt !== undefined) {
      sets.push(`lifted_at = $${idx++}`);
      params.push(patch.liftedAt);
    }
    if (!sets.length) {
      const rows = await this.q(`SELECT * FROM edge_subscription_suspensions WHERE id = $1`, [id]);
      return this.mapSuspension(rows[0]!);
    }
    params.push(id);
    const rows = await this.q(
      `UPDATE edge_subscription_suspensions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return this.mapSuspension(rows[0]!);
  }

  async createSuspension(input: Parameters<SubscriptionRepositoryPort['createSuspension']>[0]) {
    const rows = await this.q(
      `INSERT INTO edge_subscription_suspensions
         (subscription_id, reason, reason_detail, requested_by, approved_by, effective_at, status)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()), COALESCE($7, 'ACTIVE'))
       RETURNING *`,
      [
        input.subscriptionId,
        input.reason,
        input.reasonDetail ?? null,
        input.requestedBy ?? null,
        input.approvedBy ?? null,
        input.effectiveAt ?? null,
        input.status ?? 'ACTIVE',
      ],
    );
    return this.mapSuspension(rows[0]!);
  }

  async listCancellations(subscriptionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_subscription_cancellations WHERE subscription_id = $1 ORDER BY created_at DESC`,
      [subscriptionId],
    );
    return rows.map((r) => this.mapCancellation(r));
  }

  async createCancellation(input: Parameters<SubscriptionRepositoryPort['createCancellation']>[0]) {
    const rows = await this.q(
      `INSERT INTO edge_subscription_cancellations
         (subscription_id, reason, notice_days, effective_at, requested_by, approved_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'REQUESTED'))
       RETURNING *`,
      [
        input.subscriptionId,
        input.reason,
        input.noticeDays ?? null,
        input.effectiveAt ?? null,
        input.requestedBy ?? null,
        input.approvedBy ?? null,
        input.status ?? 'REQUESTED',
      ],
    );
    return this.mapCancellation(rows[0]!);
  }

  async createBillingCoordination(
    input: Parameters<SubscriptionRepositoryPort['createBillingCoordination']>[0],
  ) {
    const rows = await this.q(
      `INSERT INTO edge_subscription_billing_coordination
         (subscription_id, outcome, billing_account_ref, payload, external_ref, failure_message, correlation_id)
       VALUES ($1, COALESCE($2, 'REQUESTED'), $3, COALESCE($4, '{}'::jsonb), $5, $6, $7)
       RETURNING *`,
      [
        input.subscriptionId,
        input.outcome ?? 'REQUESTED',
        input.billingAccountRef ?? null,
        JSON.stringify(input.payload ?? {}),
        input.externalRef ?? null,
        input.failureMessage ?? null,
        input.correlationId ?? null,
      ],
    );
    return this.mapBilling(rows[0]!);
  }

  async updateBillingCoordination(
    id: string,
    patch: Parameters<SubscriptionRepositoryPort['updateBillingCoordination']>[1],
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (patch.outcome !== undefined) {
      sets.push(`outcome = $${idx++}`);
      params.push(patch.outcome);
    }
    if (patch.externalRef !== undefined) {
      sets.push(`external_ref = $${idx++}`);
      params.push(patch.externalRef);
    }
    if (patch.failureMessage !== undefined) {
      sets.push(`failure_message = $${idx++}`);
      params.push(patch.failureMessage);
    }
    if (patch.confirmedAt !== undefined) {
      sets.push(`confirmed_at = $${idx++}`);
      params.push(patch.confirmedAt);
    }
    params.push(id);
    const rows = await this.q(
      `UPDATE edge_subscription_billing_coordination SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return this.mapBilling(rows[0]!);
  }

  async listBillingCoordination(subscriptionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_subscription_billing_coordination WHERE subscription_id = $1 ORDER BY created_at DESC`,
      [subscriptionId],
    );
    return rows.map((r) => this.mapBilling(r));
  }

  async createProvisioningRequest(
    input: Parameters<SubscriptionRepositoryPort['createProvisioningRequest']>[0],
  ) {
    const existing = await this.getProvisioningByCorrelation(input.correlationId);
    if (existing) return existing;
    const rows = await this.q(
      `INSERT INTO edge_subscription_provisioning_requests
         (subscription_id, outcome, tenant_ref, payload, external_ref, failure_message, correlation_id)
       VALUES ($1, COALESCE($2, 'REQUESTED'), $3, COALESCE($4, '{}'::jsonb), $5, $6, $7)
       ON CONFLICT (correlation_id) DO NOTHING
       RETURNING *`,
      [
        input.subscriptionId,
        input.outcome ?? 'REQUESTED',
        input.tenantRef ?? null,
        JSON.stringify(input.payload ?? {}),
        input.externalRef ?? null,
        input.failureMessage ?? null,
        input.correlationId,
      ],
    );
    if (!rows[0]) {
      const replay = await this.getProvisioningByCorrelation(input.correlationId);
      if (replay) return replay;
    }
    return this.mapProvisioning(rows[0]!);
  }

  async getProvisioningByCorrelation(correlationId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_subscription_provisioning_requests WHERE correlation_id = $1`,
      [correlationId],
    );
    return rows[0] ? this.mapProvisioning(rows[0]) : null;
  }

  async listProvisioningRequests(subscriptionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_subscription_provisioning_requests WHERE subscription_id = $1 ORDER BY created_at DESC`,
      [subscriptionId],
    );
    return rows.map((r) => this.mapProvisioning(r));
  }

  async updateProvisioningRequest(
    id: string,
    patch: Parameters<SubscriptionRepositoryPort['updateProvisioningRequest']>[1],
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (patch.outcome !== undefined) {
      sets.push(`outcome = $${idx++}`);
      params.push(patch.outcome);
    }
    if (patch.tenantRef !== undefined) {
      sets.push(`tenant_ref = $${idx++}`);
      params.push(patch.tenantRef);
    }
    if (patch.externalRef !== undefined) {
      sets.push(`external_ref = $${idx++}`);
      params.push(patch.externalRef);
    }
    if (patch.failureMessage !== undefined) {
      sets.push(`failure_message = $${idx++}`);
      params.push(patch.failureMessage);
    }
    if (patch.completedAt !== undefined) {
      sets.push(`completed_at = $${idx++}`);
      params.push(patch.completedAt);
    }
    params.push(id);
    const rows = await this.q(
      `UPDATE edge_subscription_provisioning_requests SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return this.mapProvisioning(rows[0]!);
  }

  async getPolicyByCode(code: string) {
    const rows = await this.q(`SELECT * FROM edge_subscription_policies WHERE code = $1`, [code]);
    return rows[0] ? this.mapPolicy(rows[0]) : null;
  }

  async listPolicies(opts?: Parameters<SubscriptionRepositoryPort['listPolicies']>[0]) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts?.status) {
      clauses.push(`status = $1`);
      params.push(opts.status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.q(
      `SELECT * FROM edge_subscription_policies ${where} ORDER BY code`,
      params,
    );
    return rows.map((r) => this.mapPolicy(r));
  }

  async upsertPolicy(input: Parameters<SubscriptionRepositoryPort['upsertPolicy']>[0]) {
    const rows = await this.q(
      `INSERT INTO edge_subscription_policies (code, policy_type, rules, status)
       VALUES ($1, COALESCE($2, 'ACTIVATION'), COALESCE($3, '{}'::jsonb), COALESCE($4, 'ACTIVE'))
       ON CONFLICT (code) DO UPDATE SET
         policy_type = COALESCE(EXCLUDED.policy_type, edge_subscription_policies.policy_type),
         rules = COALESCE(EXCLUDED.rules, edge_subscription_policies.rules),
         status = COALESCE(EXCLUDED.status, edge_subscription_policies.status),
         updated_at = NOW()
       RETURNING *`,
      [
        input.code,
        input.policyType ?? null,
        JSON.stringify(input.rules ?? {}),
        input.status ?? null,
      ],
    );
    return this.mapPolicy(rows[0]!);
  }

  async createApproval(input: Parameters<SubscriptionRepositoryPort['createApproval']>[0]) {
    const rows = await this.q(
      `INSERT INTO edge_subscription_approvals
         (subscription_id, change_request_id, approval_type, status, requested_by,
          decision_by, decision_note, decided_at)
       VALUES ($1, $2, $3, COALESCE($4, 'PENDING'), $5, $6, $7, $8)
       RETURNING *`,
      [
        input.subscriptionId ?? null,
        input.changeRequestId ?? null,
        input.approvalType,
        input.status ?? 'PENDING',
        input.requestedBy ?? null,
        input.decisionBy ?? null,
        input.decisionNote ?? null,
        input.decidedAt ?? null,
      ],
    );
    return this.mapApproval(rows[0]!);
  }

  async listApprovals(opts?: Parameters<SubscriptionRepositoryPort['listApprovals']>[0]) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (opts?.subscriptionId) {
      clauses.push(`subscription_id = $${idx++}`);
      params.push(opts.subscriptionId);
    }
    if (opts?.changeRequestId) {
      clauses.push(`change_request_id = $${idx++}`);
      params.push(opts.changeRequestId);
    }
    if (opts?.status) {
      clauses.push(`status = $${idx++}`);
      params.push(opts.status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = opts?.limit ?? 100;
    const rows = await this.q(
      `SELECT * FROM edge_subscription_approvals ${where} ORDER BY created_at DESC LIMIT $${idx++}`,
      [...params, limit],
    );
    return rows.map((r) => this.mapApproval(r));
  }

  async createScheduledChange(input: Parameters<SubscriptionRepositoryPort['createScheduledChange']>[0]) {
    const rows = await this.q(
      `INSERT INTO edge_subscription_scheduled_changes (change_request_id, execute_at, status)
       VALUES ($1, $2, COALESCE($3, 'SCHEDULED'))
       RETURNING *`,
      [input.changeRequestId, input.executeAt, input.status ?? 'SCHEDULED'],
    );
    return this.mapScheduledChange(rows[0]!);
  }

  async listScheduledChanges(changeRequestId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_subscription_scheduled_changes WHERE change_request_id = $1 ORDER BY created_at DESC`,
      [changeRequestId],
    );
    return rows.map((r) => this.mapScheduledChange(r));
  }

  async listDueScheduledChanges(asOf?: Date) {
    const when = asOf ?? new Date();
    const rows = await this.q(
      `SELECT sc.*, cr.subscription_id
       FROM edge_subscription_scheduled_changes sc
       INNER JOIN edge_subscription_change_requests cr ON cr.id = sc.change_request_id
       WHERE sc.status = 'SCHEDULED' AND sc.execute_at <= $1
       ORDER BY sc.execute_at ASC
       LIMIT 100`,
      [when],
    );
    return rows.map((r) => ({
      ...this.mapScheduledChange(r),
      subscriptionId: String(r.subscription_id),
      changeRequestId: String(r.change_request_id),
    }));
  }

  async cancelScheduledChange(id: string) {
    const rows = await this.q(
      `UPDATE edge_subscription_scheduled_changes
       SET status = 'CANCELLED', cancelled_at = NOW()
       WHERE id = $1 AND status = 'SCHEDULED'
       RETURNING *`,
      [id],
    );
    if (!rows[0]) {
      throw new Error('Scheduled change not found or not cancellable');
    }
    return this.mapScheduledChange(rows[0]);
  }

  async markScheduledExecuted(id: string) {
    const rows = await this.q(
      `UPDATE edge_subscription_scheduled_changes SET status = 'EXECUTED' WHERE id = $1 RETURNING *`,
      [id],
    );
    return this.mapScheduledChange(rows[0]!);
  }

  async getOverviewStats(): Promise<OverviewStats> {
    const totalRows = await this.q<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM edge_subscriptions`,
    );
    const byStatus = await this.q<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM edge_subscriptions GROUP BY status`,
    );
    const trials = await this.q<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM edge_subscription_trials WHERE status = 'ACTIVE'`,
    );
    const pendingAct = await this.q<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM edge_subscriptions WHERE status IN ('PENDING_ACTIVATION', 'PENDING_PROVISIONING')`,
    );
    const byStatusMap: Record<string, number> = {};
    for (const row of byStatus) {
      byStatusMap[row.status] = Number(row.count);
    }
    return {
      totalSubscriptions: Number(totalRows[0]?.count ?? 0),
      byStatus: byStatusMap,
      activeTrials: Number(trials[0]?.count ?? 0),
      pendingActivation: Number(pendingAct[0]?.count ?? 0),
      note: 'Contractual counts only — not recognized revenue (P6)',
      dataQuality: 'PARTIAL',
    };
  }

  async beginIdempotency(input: Parameters<SubscriptionRepositoryPort['beginIdempotency']>[0]) {
    const existing = await this.q(
      `SELECT resource_id, response_snapshot FROM edge_subscription_idempotency_keys WHERE idempotency_key = $1`,
      [input.idempotencyKey],
    );
    if (existing[0]) {
      const snap = (existing[0].response_snapshot as Record<string, unknown>) ?? {};
      return {
        replay: Object.keys(snap).length > 0,
        resourceId: (existing[0].resource_id as string | null) ?? null,
        responseSnapshot: snap,
      };
    }
    await this.q(
      `INSERT INTO edge_subscription_idempotency_keys
         (idempotency_key, operation, resource_type, response_snapshot)
       VALUES ($1, $2, $3, '{}'::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [input.idempotencyKey, input.operation, input.resourceType],
    );
    return { replay: false, resourceId: null, responseSnapshot: {} };
  }

  async completeIdempotency(input: Parameters<SubscriptionRepositoryPort['completeIdempotency']>[0]) {
    await this.q(
      `UPDATE edge_subscription_idempotency_keys
       SET resource_id = COALESCE($2, resource_id),
           response_snapshot = COALESCE($3, response_snapshot)
       WHERE idempotency_key = $1`,
      [
        input.idempotencyKey,
        input.resourceId ?? null,
        JSON.stringify(input.responseSnapshot),
      ],
    );
  }
}
