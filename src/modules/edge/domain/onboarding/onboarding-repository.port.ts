import type {
  OnboardingEvidenceRecord,
  OnboardingJourneyRecord,
  OnboardingRunRecord,
  OnboardingStepRecord,
  OnboardingTaskRecord,
  OnboardingTemplateRecord,
} from './onboarding.types.js';

export const ONBOARDING_REPOSITORY_PORT = Symbol('ONBOARDING_REPOSITORY_PORT');

export interface OnboardingRepositoryPort {
  createTemplate(
    input: Omit<OnboardingTemplateRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<OnboardingTemplateRecord>;
  getTemplate(id: string): Promise<OnboardingTemplateRecord | null>;
  getTemplateByCode(code: string): Promise<OnboardingTemplateRecord | null>;
  listTemplates(filter: {
    status?: string;
    productId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: OnboardingTemplateRecord[]; total: number }>;
  updateTemplate(
    id: string,
    patch: Partial<OnboardingTemplateRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<OnboardingTemplateRecord>;

  createJourney(
    input: Omit<OnboardingJourneyRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<OnboardingJourneyRecord>;
  getJourney(id: string): Promise<OnboardingJourneyRecord | null>;
  getActiveJourney(
    tenantId: string,
    productId: string,
  ): Promise<OnboardingJourneyRecord | null>;
  listJourneys(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    activationRecordId?: string;
    templateId?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: OnboardingJourneyRecord[]; total: number }>;
  updateJourney(
    id: string,
    patch: Partial<OnboardingJourneyRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<OnboardingJourneyRecord>;

  createSteps(
    inputs: Array<
      Omit<OnboardingStepRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    >,
    client?: unknown,
  ): Promise<OnboardingStepRecord[]>;
  listSteps(journeyId: string): Promise<OnboardingStepRecord[]>;
  getStep(id: string): Promise<OnboardingStepRecord | null>;
  updateStep(
    id: string,
    patch: Partial<OnboardingStepRecord>,
    client?: unknown,
  ): Promise<OnboardingStepRecord>;

  createTask(
    input: Omit<OnboardingTaskRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<OnboardingTaskRecord>;
  getTask(id: string): Promise<OnboardingTaskRecord | null>;
  listTasks(filter: {
    journeyId?: string;
    status?: string;
    limit?: number;
  }): Promise<OnboardingTaskRecord[]>;
  updateTask(
    id: string,
    patch: Partial<OnboardingTaskRecord>,
    client?: unknown,
  ): Promise<OnboardingTaskRecord>;

  createRun(
    input: Omit<OnboardingRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<OnboardingRunRecord>;
  listRuns(journeyId: string, limit?: number): Promise<OnboardingRunRecord[]>;
  updateRun(
    id: string,
    patch: Partial<OnboardingRunRecord>,
    client?: unknown,
  ): Promise<OnboardingRunRecord>;

  createEvidence(
    input: Omit<OnboardingEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<OnboardingEvidenceRecord>;
  listEvidence(filter: {
    journeyId?: string;
    limit?: number;
  }): Promise<OnboardingEvidenceRecord[]>;

  appendHistory(
    input: {
      resourceType: string;
      resourceId: string;
      tenantId?: string | null;
      fromStatus?: string | null;
      toStatus?: string | null;
      action: string;
      reason?: string | null;
      actorId: string;
      details?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<void>;
}
