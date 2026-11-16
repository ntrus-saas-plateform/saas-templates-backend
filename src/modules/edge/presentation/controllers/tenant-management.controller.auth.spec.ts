import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../../../../shared/auth/decorators.js';
import { EdgeTenantManagementController } from './tenant-management.controller.js';

describe('EdgeTenantManagementController authz', () => {
  const cases: Array<{ method: keyof EdgeTenantManagementController; permission: string }> = [
    { method: 'searchTenants', permission: 'platform:tenant_management:search' },
    { method: 'exportTenantRegistry', permission: 'platform:tenant_management:export' },
    { method: 'portfolioUnderTenants', permission: 'platform:tenant_management:analytics:read' },
    { method: 'portfolioUnderManagement', permission: 'platform:tenant_management:analytics:read' },
    { method: 'register', permission: 'platform:tenant_management:register' },
    { method: 'syncP7', permission: 'platform:tenant_management:register' },
    { method: 'listGlobalLifecycleRequests', permission: 'platform:tenant_management:lifecycle:request' },
    { method: 'approveLifecycleRequest', permission: 'platform:tenant_management:lifecycle:approve' },
    { method: 'rejectLifecycleRequest', permission: 'platform:tenant_management:lifecycle:approve' },
    { method: 'listGlobalExceptions', permission: 'platform:tenant_management:exception:request' },
    { method: 'createException', permission: 'platform:tenant_management:exception:request' },
    { method: 'approveExceptionEndpoint', permission: 'platform:tenant_management:exception:approve' },
    { method: 'revokeExceptionEndpoint', permission: 'platform:tenant_management:exception:approve' },
    { method: 'expireDueExceptions', permission: 'platform:tenant_management:exception:approve' },
    { method: 'listGlobalMigrations', permission: 'platform:tenant_management:migration:request' },
    { method: 'createMigration', permission: 'platform:tenant_management:migration:request' },
    { method: 'approveMigrationEndpoint', permission: 'platform:tenant_management:migration:approve' },
    { method: 'rejectMigrationEndpoint', permission: 'platform:tenant_management:migration:approve' },
    { method: 'listGlobalRecoveries', permission: 'platform:tenant_management:recovery:request' },
    { method: 'createRecovery', permission: 'platform:tenant_management:recovery:request' },
    { method: 'approveRecoveryEndpoint', permission: 'platform:tenant_management:recovery:approve' },
    { method: 'rejectRecoveryEndpoint', permission: 'platform:tenant_management:recovery:approve' },
    { method: 'listGlobalTerminations', permission: 'platform:tenant_management:termination:request' },
    { method: 'createTermination', permission: 'platform:tenant_management:termination:request' },
    { method: 'approveTerminationEndpoint', permission: 'platform:tenant_management:termination:approve' },
    { method: 'rejectTerminationEndpoint', permission: 'platform:tenant_management:termination:approve' },
    { method: 'reconciliationRun', permission: 'platform:tenant_management:reconciliation:execute' },
    { method: 'reconciliationFindings', permission: 'platform:tenant_management:reconciliation:execute' },
    { method: 'reconciliationRuns', permission: 'platform:tenant_management:reconciliation:execute' },
    { method: 'acknowledgeReconciliationFinding', permission: 'platform:tenant_management:reconciliation:remediate' },
    { method: 'bulkPreview', permission: 'platform:tenant_management:bulk:execute' },
    { method: 'bulkExecute', permission: 'platform:tenant_management:bulk:execute' },
    { method: 'listBulkOps', permission: 'platform:tenant_management:bulk:execute' },
    { method: 'getTenantById', permission: 'platform:tenant_management:read' },
    { method: 'getTenant360ById', permission: 'platform:tenant_management:read' },
    { method: 'patchTenant', permission: 'platform:tenant_management:update_metadata' },
    { method: 'assignTenantOwner', permission: 'platform:tenant_management:assign_owner' },
    { method: 'addTag', permission: 'platform:tenant_management:manage_tags' },
    { method: 'removeTag', permission: 'platform:tenant_management:manage_tags' },
    { method: 'addTenantNote', permission: 'platform:tenant_management:update_metadata' },
    { method: 'tenantActivity', permission: 'platform:tenant_management:audit:read' },
    { method: 'postHealthSnapshot', permission: 'platform:tenant_management:update_metadata' },
    { method: 'getHealthSnapshots', permission: 'platform:tenant_management:read' },
    { method: 'postRiskAssessment', permission: 'platform:tenant_management:update_metadata' },
    { method: 'getRiskAssessments', permission: 'platform:tenant_management:read' },
    { method: 'patchTenantPolicies', permission: 'platform:tenant_management:update_metadata' },
    {
      method: 'postTenantDeprovisionAuthorization',
      permission: 'platform:tenant_management:deprovision:authorize',
    },
    {
      method: 'postTenantLegalHold',
      permission: 'platform:tenant_management:legal_hold:manage',
    },
    {
      method: 'postTenantLegalHoldRequest',
      permission: 'platform:tenant_management:legal_hold:manage',
    },
    {
      method: 'listLegalHoldRequests',
      permission: 'platform:tenant_management:legal_hold:approve',
    },
    {
      method: 'approveLegalHoldRequest',
      permission: 'platform:tenant_management:legal_hold:approve',
    },
    {
      method: 'rejectLegalHoldRequest',
      permission: 'platform:tenant_management:legal_hold:approve',
    },
    { method: 'tenantLifecycleRequest', permission: 'platform:tenant_management:lifecycle:request' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgeTenantManagementController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EdgeTenantManagementController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});