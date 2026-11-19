import type {
  ActivityEventRecord,
  ApplicationRef,
  BulkOperationRecord,
  CommercialProjection,
  ConfigurationRef,
  ExceptionRecord,
  HealthSnapshotRecord,
  LegalHoldChangeRequestRecord,
  LifecycleRequestRecord,
  MigrationRequestRecord,
  RecoveryRequestRecord,
  ReconciliationFindingRecord,
  ReconciliationRunRecord,
  RiskAssessmentRecord,
  TechnicalResourceRef,
  OperatorScopeRecord,
  TenantNoteRecord,
  TenantPortfolioMetrics,
  TenantRegistryRecord,
  TenantSearchFilter,
  TenantTagRecord,
  TerminationRequestRecord,
} from './tenant-management.types.js';

export const TENANT_MANAGEMENT_REPOSITORY_PORT = Symbol('TENANT_MANAGEMENT_REPOSITORY_PORT');

export interface TenantManagementRepositoryPort {
  registerTenant(
    input: Omit<TenantRegistryRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TenantRegistryRecord>;

  upsertByProductTenantId(
    input: Omit<TenantRegistryRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TenantRegistryRecord>;

  getById(id: string): Promise<TenantRegistryRecord | null>;
  getByProductTenantId(productTenantId: string): Promise<TenantRegistryRecord | null>;
  getByCode(tenantCode: string): Promise<TenantRegistryRecord | null>;

  search(
    filter: TenantSearchFilter,
  ): Promise<{ items: TenantRegistryRecord[]; total: number }>;

  updateTenant(
    id: string,
    patch: Partial<TenantRegistryRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantRegistryRecord>;

  listTags(tenantRegistryId: string): Promise<TenantTagRecord[]>;
  addTag(
    input: Omit<TenantTagRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<TenantTagRecord>;
  removeTag(tenantRegistryId: string, tagKey: string, tagValue: string, client?: unknown): Promise<void>;

  listNotes(tenantRegistryId: string, limit?: number): Promise<TenantNoteRecord[]>;
  addNote(
    input: Omit<TenantNoteRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<TenantNoteRecord>;

  createLifecycleRequest(
    input: Omit<LifecycleRequestRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<LifecycleRequestRecord>;
  getLifecycleRequest(id: string): Promise<LifecycleRequestRecord | null>;
  getLifecycleRequestByIdempotency(key: string): Promise<LifecycleRequestRecord | null>;
  listLifecycleRequests(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: LifecycleRequestRecord[]; total: number }>;
  updateLifecycleRequest(
    id: string,
    patch: Partial<LifecycleRequestRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<LifecycleRequestRecord>;

  createException(
    input: Omit<ExceptionRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ExceptionRecord>;
  getException(id: string): Promise<ExceptionRecord | null>;
  getExceptionByIdempotency(key: string): Promise<ExceptionRecord | null>;
  listExceptions(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ExceptionRecord[]; total: number }>;
  updateException(
    id: string,
    patch: Partial<ExceptionRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<ExceptionRecord>;
  expireDueExceptions(now?: Date, client?: unknown): Promise<number>;

  createMigrationRequest(
    input: Omit<MigrationRequestRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<MigrationRequestRecord>;
  getMigrationRequest(id: string): Promise<MigrationRequestRecord | null>;
  getMigrationByIdempotency(key: string): Promise<MigrationRequestRecord | null>;
  listMigrationRequests(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: MigrationRequestRecord[]; total: number }>;
  updateMigrationRequest(
    id: string,
    patch: Partial<MigrationRequestRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<MigrationRequestRecord>;

  createRecoveryRequest(
    input: Omit<RecoveryRequestRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<RecoveryRequestRecord>;
  getRecoveryRequest(id: string): Promise<RecoveryRequestRecord | null>;
  getRecoveryByIdempotency(key: string): Promise<RecoveryRequestRecord | null>;
  listRecoveryRequests(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: RecoveryRequestRecord[]; total: number }>;
  updateRecoveryRequest(
    id: string,
    patch: Partial<RecoveryRequestRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<RecoveryRequestRecord>;

  createTerminationRequest(
    input: Omit<TerminationRequestRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TerminationRequestRecord>;
  getTerminationRequest(id: string): Promise<TerminationRequestRecord | null>;
  getTerminationByIdempotency(key: string): Promise<TerminationRequestRecord | null>;
  listTerminationRequests(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: TerminationRequestRecord[]; total: number }>;
  updateTerminationRequest(
    id: string,
    patch: Partial<TerminationRequestRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<TerminationRequestRecord>;

  createReconciliationRun(
    input: Omit<ReconciliationRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ReconciliationRunRecord>;
  updateReconciliationRun(
    id: string,
    patch: Partial<ReconciliationRunRecord>,
    client?: unknown,
  ): Promise<ReconciliationRunRecord>;
  createFinding(
    input: Omit<ReconciliationFindingRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<ReconciliationFindingRecord>;
  listFindings(filter: {
    runId?: string;
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ReconciliationFindingRecord[]; total: number }>;
  listReconciliationRuns(filter: {
    limit?: number;
    offset?: number;
  }): Promise<{ items: ReconciliationRunRecord[]; total: number }>;
  updateFindingStatus(
    id: string,
    status: string,
    client?: unknown,
  ): Promise<ReconciliationFindingRecord>;

  countOpenExceptions(tenantRegistryId: string): Promise<number>;
  countActiveExceptions(tenantRegistryId: string): Promise<number>;

  createHealthSnapshot(
    input: Omit<HealthSnapshotRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<HealthSnapshotRecord>;
  listHealthSnapshots(
    tenantRegistryId: string,
    limit?: number,
  ): Promise<HealthSnapshotRecord[]>;
  getLatestHealthSnapshot(tenantRegistryId: string): Promise<HealthSnapshotRecord | null>;
  updateTenantHealthFromSnapshot(
    tenantRegistryId: string,
    overallStatus: string,
    observedAt: Date,
    actorId: string,
    client?: unknown,
  ): Promise<TenantRegistryRecord>;

  createRiskAssessment(
    input: Omit<RiskAssessmentRecord, 'id' | 'createdAt' | 'evaluatedAt'> & {
      id?: string;
      evaluatedAt?: Date;
    },
    client?: unknown,
  ): Promise<RiskAssessmentRecord>;
  listRiskAssessments(tenantRegistryId: string, limit?: number): Promise<RiskAssessmentRecord[]>;
  getLatestRiskAssessment(tenantRegistryId: string): Promise<RiskAssessmentRecord | null>;
  updateTenantRiskLevel(
    tenantRegistryId: string,
    riskLevel: string,
    actorId: string,
    client?: unknown,
  ): Promise<TenantRegistryRecord>;

  createBulkOperation(
    input: Omit<BulkOperationRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<BulkOperationRecord>;
  getBulkOperation(id: string): Promise<BulkOperationRecord | null>;
  getBulkOperationByIdempotency(key: string): Promise<BulkOperationRecord | null>;
  updateBulkOperation(
    id: string,
    patch: Partial<BulkOperationRecord>,
    client?: unknown,
  ): Promise<BulkOperationRecord>;
  listBulkOperations(filter: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: BulkOperationRecord[]; total: number }>;

  createAnalyticsSnapshot(snapshotKey: string, metrics: Record<string, unknown>): Promise<void>;
  exportTenantsCsv(filter: TenantSearchFilter, maxRows?: number): Promise<string>;

  getCommercialProjection(subscriptionId: string | null): Promise<CommercialProjection>;
  getTechnicalResources(productTenantId: string): Promise<TechnicalResourceRef[]>;
  getApplicationRefs(productTenantId: string): Promise<ApplicationRef[]>;
  getConfigurationRefs(productTenantId: string): Promise<ConfigurationRef[]>;

  updateLegalHold(
    id: string,
    legalHold: boolean,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantRegistryRecord>;

  verifySubscriptionProduct(
    subscriptionId: string,
    productId: string,
    client?: unknown,
  ): Promise<
    | 'UNAVAILABLE_TABLE'
    | 'NOT_FOUND'
    | 'PRODUCT_MISMATCH'
    | 'INACTIVE'
    | 'VERIFIED'
  >;

  listOperatorScopes(administratorId: string): Promise<OperatorScopeRecord[]>;
  upsertOperatorScope(
    input: {
      administratorId: string;
      region?: string | null;
      accountId?: string | null;
      productId?: string | null;
      ownerSubjectId?: string | null;
    },
    client?: unknown,
  ): Promise<OperatorScopeRecord>;
  deleteOperatorScopes(administratorId: string, client?: unknown): Promise<number>;

  createLegalHoldChangeRequest(
    input: Omit<
      LegalHoldChangeRequestRecord,
      'id' | 'createdAt' | 'updatedAt' | 'version'
    > & { id?: string; version?: number },
    client?: unknown,
  ): Promise<LegalHoldChangeRequestRecord>;
  getLegalHoldChangeRequest(id: string): Promise<LegalHoldChangeRequestRecord | null>;
  getLegalHoldChangeRequestByIdempotency(
    key: string,
  ): Promise<LegalHoldChangeRequestRecord | null>;
  listLegalHoldChangeRequests(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: LegalHoldChangeRequestRecord[]; total: number }>;
  updateLegalHoldChangeRequest(
    id: string,
    patch: Partial<LegalHoldChangeRequestRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<LegalHoldChangeRequestRecord>;
  updateGovernancePolicies(
    id: string,
    patch: {
      retentionPolicyRef?: string | null;
      securityPolicyRef?: string | null;
      dataResidencyRef?: string | null;
      deletionProtection?: boolean;
    },
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantRegistryRecord>;

  appendActivity(
    input: Omit<ActivityEventRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ActivityEventRecord>;
  listActivity(filter: {
    tenantRegistryId?: string;
    productTenantId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ActivityEventRecord[]; total: number }>;

  portfolioMetrics(verticalId?: string): Promise<TenantPortfolioMetrics>;

  /** Projection helpers for reconciliation / sync */
  listDistinctProductTenantIdsFromP7(): Promise<
    Array<{
      productTenantId: string;
      productId: string | null;
      subscriptionId: string | null;
      accountId: string | null;
      lifecycleStatus: string | null;
      activationRecordId: string | null;
      lifecycleRecordId: string | null;
      provisioningRequestId: string | null;
    }>
  >;
  listRegistryProductTenantIds(): Promise<string[]>;
  detectDuplicateRegistryRows(): Promise<
    Array<{ tenantCode: string; count: number; productTenantIds: string[] }>
  >;
  detectDuplicateAccountProductRefs(): Promise<
    Array<{ accountId: string; productId: string; productTenantIds: string[] }>
  >;
}
