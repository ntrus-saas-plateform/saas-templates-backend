import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from '@prometheus-io/client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequestCount: Counter<'method' | 'route' | 'status'>;
  readonly httpRequestDuration: Histogram<'method' | 'route'>;
  readonly outboxPending: Counter;
  readonly outboxFailed: Counter;
  readonly outboxDeadLetter: Counter<'store'>;
  readonly databasePoolUsage: Counter<'tenant_id'>;
  readonly circuitBreakerOpen: Counter<'tenant_id'>;
  readonly identityLoginFailures: Counter<'reason'>;
  readonly identityPermissionDenied: Counter;
  readonly identityCrossTenantAttempts: Counter;
  readonly identityInvitationFailures: Counter<'reason'>;
  readonly identityMembershipChanges: Counter<'operation'>;
  readonly identityReconciliationDrifts: Counter<'drift_type'>;
  readonly commercialOrderLatency: Histogram<'operation'>;
  readonly commercialPricingLatency: Histogram<'operation'>;
  readonly commercialAtpLatency: Histogram<'operation'>;
  readonly commercialReservationLatency: Histogram<'operation'>;
  readonly commercialPaymentLatency: Histogram<'operation'>;
  readonly commercialFulfillmentLatency: Histogram<'operation'>;
  readonly inventoryTransactionsTotal: Counter<'type'>;
  readonly inventoryAdjustmentsTotal: Counter;
  readonly inventoryNegativeStockAttempts: Counter;
  readonly inventoryReservationsTotal: Counter;
  readonly inventoryTransferDuration: Histogram;
  readonly inventoryReceivingDuration: Histogram;
  readonly inventoryExpirationCount: Gauge;
  readonly inventoryQuarantineCount: Gauge;

  /** ERP orchestration metrics (req 83). */
  readonly ordersProcessed: Counter;
  readonly ordersFailed: Counter;
  readonly reservationsFailed: Counter;
  readonly paymentsFailed: Counter;
  readonly inventoryPostingsFailed: Counter;
  readonly accountingPostingsPending: Gauge;
  readonly sagaFailures: Counter<'saga_type'>;
  readonly eventRetries: Counter;
  readonly deadLetterEvents: Counter;
  readonly reconciliationMismatches: Counter<'pair_type'>;
  readonly circuitBreakerTrips: Counter<'dependency'>;

  /** Business context / multi-vertical configuration metrics. */
  readonly businessContextResolveTotal: Counter<'result'>;
  readonly businessContextResolveDuration: Histogram<'result'>;
  readonly businessCapabilityMutationTotal: Counter<'action' | 'result'>;
  readonly businessPolicyDriftTotal: Counter<'namespace'>;
  readonly crmCampaignAudienceTotal: Counter<'result'>;
  readonly mcpDenied: Counter<'tool' | 'code'>;
  readonly offlineSyncConflict: Counter;
  readonly boutiqueReservations: Counter;
  readonly customer360Latency: Histogram;

  /** Okapi Edge Platform metrics (low-cardinality labels only). */
  readonly edgeInvitationsTotal: Counter<'result'>;
  readonly edgeInvitationDeliveryFailures: Counter;
  readonly edgeAdministratorSuspensions: Counter;
  readonly edgeMembershipMutations: Counter<'operation'>;
  readonly edgeWorkspaceSwitches: Counter<'result'>;
  readonly edgeAuthorizationDenials: Counter;
  readonly edgeInvalidWorkspaceContexts: Counter;
  readonly edgeSessionMutations: Counter<'operation'>;
  readonly edgeKeycloakSyncFailures: Counter;
  readonly edgeReconciliationDrifts: Counter<'drift_type'>;
  readonly edgeAuditPersistenceFailures: Counter;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestCount = new Counter({
      name: 'http_request_count',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_latency_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.outboxPending = new Counter({
      name: 'outbox_pending_total',
      help: 'Outbox messages pending publication',
      registers: [this.registry],
    });

    this.outboxFailed = new Counter({
      name: 'outbox_failed_total',
      help: 'Outbox messages failed',
      registers: [this.registry],
    });

    this.outboxDeadLetter = new Counter({
      name: 'outbox_dead_letter_total',
      help: 'Outbox messages moved to dead letter queue',
      labelNames: ['store'],
      registers: [this.registry],
    });

    this.databasePoolUsage = new Counter({
      name: 'database_pool_usage_total',
      help: 'Database pool usage events',
      labelNames: ['tenant_id'],
      registers: [this.registry],
    });

    this.circuitBreakerOpen = new Counter({
      name: 'circuit_breaker_open_total',
      help: 'Circuit breaker open events for tenant DB pools',
      labelNames: ['tenant_id'],
      registers: [this.registry],
    });

    this.identityLoginFailures = new Counter({
      name: 'identity_login_failures_total',
      help: 'Failed JWT authentication attempts',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.identityPermissionDenied = new Counter({
      name: 'identity_permission_denied_total',
      help: 'Permission or role guard denials',
      registers: [this.registry],
    });

    this.identityCrossTenantAttempts = new Counter({
      name: 'identity_cross_tenant_attempts_total',
      help: 'Tenant guard denials (missing membership or tenant)',
      registers: [this.registry],
    });

    this.identityInvitationFailures = new Counter({
      name: 'identity_invitation_failures_total',
      help: 'Invitation validation or accept failures',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.identityMembershipChanges = new Counter({
      name: 'identity_membership_changes_total',
      help: 'Membership grant and revoke operations',
      labelNames: ['operation'],
      registers: [this.registry],
    });

    this.identityReconciliationDrifts = new Counter({
      name: 'identity_reconciliation_drifts_total',
      help: 'Keycloak reconciliation drift detections',
      labelNames: ['drift_type'],
      registers: [this.registry],
    });

    const commercialBuckets = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5];

    this.commercialOrderLatency = new Histogram({
      name: 'commercial_order_latency_seconds',
      help: 'Commercial order command latency in seconds',
      labelNames: ['operation'],
      buckets: commercialBuckets,
      registers: [this.registry],
    });

    this.commercialPricingLatency = new Histogram({
      name: 'commercial_pricing_latency_seconds',
      help: 'Commercial pricing quote latency in seconds',
      labelNames: ['operation'],
      buckets: commercialBuckets,
      registers: [this.registry],
    });

    this.commercialAtpLatency = new Histogram({
      name: 'commercial_atp_latency_seconds',
      help: 'Commercial ATP / availability check latency in seconds',
      labelNames: ['operation'],
      buckets: commercialBuckets,
      registers: [this.registry],
    });

    this.commercialReservationLatency = new Histogram({
      name: 'commercial_reservation_latency_seconds',
      help: 'Commercial reservation latency in seconds',
      labelNames: ['operation'],
      buckets: commercialBuckets,
      registers: [this.registry],
    });

    this.commercialPaymentLatency = new Histogram({
      name: 'commercial_payment_latency_seconds',
      help: 'Commercial payment latency in seconds',
      labelNames: ['operation'],
      buckets: commercialBuckets,
      registers: [this.registry],
    });

    this.commercialFulfillmentLatency = new Histogram({
      name: 'commercial_fulfillment_latency_seconds',
      help: 'Commercial fulfillment latency in seconds',
      labelNames: ['operation'],
      buckets: commercialBuckets,
      registers: [this.registry],
    });

    this.inventoryTransactionsTotal = new Counter({
      name: 'inventory_transactions_total',
      help: 'Inventory stock mutations by type',
      labelNames: ['type'],
      registers: [this.registry],
    });
    this.inventoryAdjustmentsTotal = new Counter({
      name: 'inventory_adjustments_total',
      help: 'Inventory adjustments applied',
      registers: [this.registry],
    });
    this.inventoryNegativeStockAttempts = new Counter({
      name: 'inventory_negative_stock_attempts',
      help: 'Attempts to drive stock negative when forbidden',
      registers: [this.registry],
    });
    this.inventoryReservationsTotal = new Counter({
      name: 'inventory_reservations_total',
      help: 'Inventory reservations created',
      registers: [this.registry],
    });
    this.inventoryTransferDuration = new Histogram({
      name: 'inventory_transfer_duration',
      help: 'Inventory transfer operation duration seconds',
      buckets: commercialBuckets,
      registers: [this.registry],
    });
    this.inventoryReceivingDuration = new Histogram({
      name: 'inventory_receiving_duration',
      help: 'Inventory receiving operation duration seconds',
      buckets: commercialBuckets,
      registers: [this.registry],
    });
    this.inventoryExpirationCount = new Gauge({
      name: 'inventory_expiration_count',
      help: 'Lots near/at expiration (last observed)',
      registers: [this.registry],
    });
    this.inventoryQuarantineCount = new Gauge({
      name: 'inventory_quarantine_count',
      help: 'Lots in quarantine (last observed)',
      registers: [this.registry],
    });

    this.ordersProcessed = new Counter({
      name: 'orders_processed_total',
      help: 'Sales orders successfully processed/confirmed',
      registers: [this.registry],
    });
    this.ordersFailed = new Counter({
      name: 'orders_failed_total',
      help: 'Sales order processing failures',
      registers: [this.registry],
    });
    this.reservationsFailed = new Counter({
      name: 'reservations_failed_total',
      help: 'Inventory reservation failures',
      registers: [this.registry],
    });
    this.paymentsFailed = new Counter({
      name: 'payments_failed_total',
      help: 'Payment capture/authorization failures',
      registers: [this.registry],
    });
    this.inventoryPostingsFailed = new Counter({
      name: 'inventory_postings_failed_total',
      help: 'Inventory physical posting failures',
      registers: [this.registry],
    });
    this.accountingPostingsPending = new Gauge({
      name: 'accounting_postings_pending',
      help: 'Accounting postings in ACCOUNTING_PENDING',
      registers: [this.registry],
    });
    this.sagaFailures = new Counter({
      name: 'saga_failures_total',
      help: 'Orchestration saga failures',
      labelNames: ['saga_type'],
      registers: [this.registry],
    });
    this.eventRetries = new Counter({
      name: 'event_retries_total',
      help: 'Outbox/event delivery retries',
      registers: [this.registry],
    });
    this.deadLetterEvents = new Counter({
      name: 'dead_letter_events_total',
      help: 'Events moved to dead letter',
      registers: [this.registry],
    });
    this.reconciliationMismatches = new Counter({
      name: 'reconciliation_mismatches_total',
      help: 'ERP reconciliation mismatches detected',
      labelNames: ['pair_type'],
      registers: [this.registry],
    });
    this.circuitBreakerTrips = new Counter({
      name: 'erp_circuit_breaker_trips_total',
      help: 'Circuit breaker open events for external ERP dependencies',
      labelNames: ['dependency'],
      registers: [this.registry],
    });

    this.businessContextResolveTotal = new Counter({
      name: 'business_context_resolve_total',
      help: 'BusinessContext resolve attempts',
      labelNames: ['result'],
      registers: [this.registry],
    });
    this.businessContextResolveDuration = new Histogram({
      name: 'business_context_resolve_duration_seconds',
      help: 'BusinessContext resolve latency',
      labelNames: ['result'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.registry],
    });
    this.businessCapabilityMutationTotal = new Counter({
      name: 'business_capability_mutation_total',
      help: 'Capability enable/disable mutations',
      labelNames: ['action', 'result'],
      registers: [this.registry],
    });
    this.businessPolicyDriftTotal = new Counter({
      name: 'business_policy_drift_total',
      help: 'Config↔SoT policy drift detections',
      labelNames: ['namespace'],
      registers: [this.registry],
    });
    this.crmCampaignAudienceTotal = new Counter({
      name: 'crm_campaign_audience_total',
      help: 'CRM campaign audience queue/dispatch outcomes (queued|skipped|sent|failed)',
      labelNames: ['result'],
      registers: [this.registry],
    });
    this.mcpDenied = new Counter({
      name: 'mcp_denied_total',
      help: 'MCP invocations refused by permission or capability',
      labelNames: ['tool', 'code'],
      registers: [this.registry],
    });
    this.offlineSyncConflict = new Counter({
      name: 'offline_sync_conflict_total',
      help: 'Offline POS replays rejected as conflicts',
      registers: [this.registry],
    });
    this.boutiqueReservations = new Counter({
      name: 'boutique_reservations_total',
      help: 'Fashion reservations requested against Core stock',
      registers: [this.registry],
    });
    this.customer360Latency = new Histogram({
      name: 'customer_360_latency_seconds',
      help: 'Customer 360 enrichment latency',
      buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
      registers: [this.registry],
    });

    this.edgeInvitationsTotal = new Counter({
      name: 'edge_invitations_total',
      help: 'Edge administrator invitations by result',
      labelNames: ['result'],
      registers: [this.registry],
    });
    this.edgeInvitationDeliveryFailures = new Counter({
      name: 'edge_invitation_delivery_failures_total',
      help: 'Edge invitation email delivery failures',
      registers: [this.registry],
    });
    this.edgeAdministratorSuspensions = new Counter({
      name: 'edge_administrator_suspensions_total',
      help: 'Edge administrator suspension operations',
      registers: [this.registry],
    });
    this.edgeMembershipMutations = new Counter({
      name: 'edge_membership_mutations_total',
      help: 'Edge membership lifecycle mutations',
      labelNames: ['operation'],
      registers: [this.registry],
    });
    this.edgeWorkspaceSwitches = new Counter({
      name: 'edge_workspace_switches_total',
      help: 'Edge workspace switch attempts by result',
      labelNames: ['result'],
      registers: [this.registry],
    });
    this.edgeAuthorizationDenials = new Counter({
      name: 'edge_authorization_denials_total',
      help: 'Edge permission guard denials',
      registers: [this.registry],
    });
    this.edgeInvalidWorkspaceContexts = new Counter({
      name: 'edge_invalid_workspace_contexts_total',
      help: 'Invalid or stale Edge workspace session presentations',
      registers: [this.registry],
    });
    this.edgeSessionMutations = new Counter({
      name: 'edge_session_mutations_total',
      help: 'Edge workspace session create/revoke operations',
      labelNames: ['operation'],
      registers: [this.registry],
    });
    this.edgeKeycloakSyncFailures = new Counter({
      name: 'edge_keycloak_sync_failures_total',
      help: 'Edge Keycloak synchronization failures',
      registers: [this.registry],
    });
    this.edgeReconciliationDrifts = new Counter({
      name: 'edge_reconciliation_drifts_total',
      help: 'Edge identity reconciliation drift detections',
      labelNames: ['drift_type'],
      registers: [this.registry],
    });
    this.edgeAuditPersistenceFailures = new Counter({
      name: 'edge_audit_persistence_failures_total',
      help: 'Failures persisting Edge audit events',
      registers: [this.registry],
    });
  }

  observeCommercialLatency(
    metric:
      | 'commercial_order_latency_seconds'
      | 'commercial_pricing_latency_seconds'
      | 'commercial_atp_latency_seconds'
      | 'commercial_reservation_latency_seconds'
      | 'commercial_payment_latency_seconds'
      | 'commercial_fulfillment_latency_seconds',
    seconds: number,
    operation = 'default',
  ): void {
    const map = {
      commercial_order_latency_seconds: this.commercialOrderLatency,
      commercial_pricing_latency_seconds: this.commercialPricingLatency,
      commercial_atp_latency_seconds: this.commercialAtpLatency,
      commercial_reservation_latency_seconds: this.commercialReservationLatency,
      commercial_payment_latency_seconds: this.commercialPaymentLatency,
      commercial_fulfillment_latency_seconds: this.commercialFulfillmentLatency,
    } as const;
    map[metric].observe({ operation }, seconds);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
