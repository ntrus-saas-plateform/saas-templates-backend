import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  EDGE_PERMISSIONS_KEY,
  IS_PUBLIC_KEY,
} from '../../../../shared/auth/decorators.js';
import { EdgeRevenueOperationsController } from './revenue-operations.controller.js';

describe('EdgeRevenueOperationsController auth matrix', () => {
  const cases: Array<{ method: keyof EdgeRevenueOperationsController; permission: string }> = [
    { method: 'listMetricDefinitions', permission: 'platform:revenue:read' },
    { method: 'registerMetricDefinition', permission: 'platform:business:metrics:manage' },
    { method: 'publishMetricDefinition', permission: 'platform:business:metrics:manage' },
    { method: 'recordMetricSnapshot', permission: 'platform:business:metrics:manage' },
    { method: 'revenueOverview', permission: 'platform:revenue:read' },
    { method: 'computeMrrMovement', permission: 'platform:revenue:read' },
    { method: 'computeCashRevenue', permission: 'platform:revenue:read' },
    { method: 'computeChurnRates', permission: 'platform:revenue:read' },
    { method: 'retentionOverview', permission: 'platform:revenue:read' },
    { method: 'recordRetentionSnapshot', permission: 'platform:business:metrics:manage' },
    { method: 'recordUnitEconomicsSnapshot', permission: 'platform:business:metrics:manage' },
    { method: 'renewalsIntelligence', permission: 'platform:revenue:read' },
    {
      method: 'recordProductProfitabilitySnapshot',
      permission: 'platform:business:metrics:manage',
    },
    { method: 'createRevenueForecast', permission: 'platform:revenue:forecast' },
    { method: 'createForecastScenario', permission: 'platform:revenue:forecast' },
    { method: 'createLeakageCase', permission: 'platform:revenue:reconcile' },
    { method: 'transitionLeakageCase', permission: 'platform:revenue:reconcile' },
    { method: 'assuranceScan', permission: 'platform:revenue:reconcile' },
    { method: 'postCommissionPlan', permission: 'platform:commission:calculate' },
    { method: 'postCommissionCalculation', permission: 'platform:commission:calculate' },
    { method: 'approveCommissionCalculation', permission: 'platform:commission:approve' },
    { method: 'commissionReadPlaceholder', permission: 'platform:commission:read' },
    { method: 'createBusinessAlertPolicy', permission: 'platform:business:manage' },
    { method: 'listBusinessAlerts', permission: 'platform:business:read' },
    { method: 'acknowledgeBusinessAlert', permission: 'platform:business:manage' },
    { method: 'evaluateBusinessAlert', permission: 'platform:business:manage' },
    { method: 'createBusinessTarget', permission: 'platform:business:targets:manage' },
    { method: 'listBusinessTargets', permission: 'platform:business:read' },
    { method: 'createBusinessDecision', permission: 'platform:business:manage' },
    { method: 'listBusinessReports', permission: 'platform:business:read' },
    { method: 'generateBusinessReport', permission: 'platform:business:reports:manage' },
    { method: 'listBusinessAudit', permission: 'platform:business:governance:manage' },
    { method: 'postBusinessAudit', permission: 'platform:business:governance:manage' },
    { method: 'businessOverview', permission: 'platform:business:read' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgeRevenueOperationsController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EdgeRevenueOperationsController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});
