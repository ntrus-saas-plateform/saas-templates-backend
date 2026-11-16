import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  EDGE_PERMISSIONS_KEY,
  IS_PUBLIC_KEY,
} from '../../../../shared/auth/decorators.js';
import { EdgePlatformOperationsController } from './platform-operations.controller.js';

describe('EdgePlatformOperationsController auth matrix', () => {
  const cases: Array<{ method: keyof EdgePlatformOperationsController; permission: string }> = [
    { method: 'searchServices', permission: 'platform:service_catalog:read' },
    { method: 'createService', permission: 'platform:service_catalog:manage' },
    { method: 'getServiceById', permission: 'platform:service_catalog:read' },
    { method: 'patchService', permission: 'platform:service_catalog:manage' },
    { method: 'postDependency', permission: 'platform:service_catalog:manage' },
    { method: 'deleteDependency', permission: 'platform:service_catalog:manage' },
    { method: 'operationsOverview', permission: 'platform:operations:overview:read' },
    { method: 'operationsAnalytics', permission: 'platform:operations:analytics:read' },
    { method: 'postHealthSnapshot', permission: 'platform:operations:alerts:manage' },
    { method: 'getAlerts', permission: 'platform:operations:alerts:read' },
    { method: 'postAlert', permission: 'platform:operations:alerts:manage' },
    { method: 'postAckAlert', permission: 'platform:operations:alerts:manage' },
    { method: 'postResolveAlert', permission: 'platform:operations:alerts:manage' },
    { method: 'getIncidents', permission: 'platform:operations:incidents:read' },
    { method: 'postIncident', permission: 'platform:operations:incidents:manage' },
    { method: 'getIncidentById', permission: 'platform:operations:incidents:read' },
    { method: 'postIncidentTransition', permission: 'platform:operations:incidents:manage' },
    { method: 'postMajorIncident', permission: 'platform:operations:incidents:approve' },
    { method: 'getProblems', permission: 'platform:operations:problems:read' },
    { method: 'postProblem', permission: 'platform:operations:problems:manage' },
    { method: 'postRootCause', permission: 'platform:operations:problems:manage' },
    { method: 'postProblemIncidentLink', permission: 'platform:operations:problems:manage' },
    { method: 'getChanges', permission: 'platform:operations:changes:read' },
    { method: 'postChange', permission: 'platform:operations:changes:manage' },
    { method: 'postSubmitChange', permission: 'platform:operations:changes:manage' },
    { method: 'postApproveChange', permission: 'platform:operations:changes:approve' },
    { method: 'postRejectChange', permission: 'platform:operations:changes:approve' },
    { method: 'getMaintenance', permission: 'platform:operations:maintenance:read' },
    { method: 'postMaintenance', permission: 'platform:operations:maintenance:manage' },
    { method: 'getRequests', permission: 'platform:operations:requests:read' },
    { method: 'postRequest', permission: 'platform:operations:requests:manage' },
    { method: 'getTasks', permission: 'platform:operations:tasks:read' },
    { method: 'postTask', permission: 'platform:operations:tasks:manage' },
    { method: 'getOnCallRotations', permission: 'platform:operations:oncall:read' },
    { method: 'postOnCallRotation', permission: 'platform:operations:oncall:manage' },
    { method: 'getSlos', permission: 'platform:operations:slo:read' },
    { method: 'postSlo', permission: 'platform:operations:slo:manage' },
    { method: 'postSloMeasurement', permission: 'platform:operations:slo:manage' },
    { method: 'getCapacity', permission: 'platform:operations:capacity:read' },
    { method: 'postCapacity', permission: 'platform:operations:capacity:manage' },
    { method: 'getRecovery', permission: 'platform:operations:recovery:read' },
    { method: 'postRecovery', permission: 'platform:operations:recovery:manage' },
    { method: 'postVerifyRecovery', permission: 'platform:operations:recovery:manage' },
    { method: 'getRunbooks', permission: 'platform:operations:runbooks:read' },
    { method: 'postRunbook', permission: 'platform:operations:runbooks:manage' },
    { method: 'getStatusComponents', permission: 'platform:operations:status:read' },
    { method: 'postStatusPublication', permission: 'platform:operations:status:publish' },
    { method: 'postApproveStatus', permission: 'platform:operations:status:publish' },
    { method: 'getRisks', permission: 'platform:operations:risks:read' },
    { method: 'postRisk', permission: 'platform:operations:risks:manage' },
    { method: 'getExceptions', permission: 'platform:operations:risks:read' },
    { method: 'postException', permission: 'platform:operations:risks:manage' },
    { method: 'postFlagExpiredExceptions', permission: 'platform:operations:risks:manage' },
    { method: 'postAutomation', permission: 'platform:operations:automation:manage' },
    { method: 'postAutomationExecution', permission: 'platform:operations:automation:execute' },
    {
      method: 'postApproveAutomationExecution',
      permission: 'platform:operations:automation:manage',
    },
    { method: 'postExecuteAutomation', permission: 'platform:operations:automation:execute' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgePlatformOperationsController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EdgePlatformOperationsController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});
