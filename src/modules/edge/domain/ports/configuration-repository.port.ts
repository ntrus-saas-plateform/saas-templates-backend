import type {
  ConfigurationVersionStatus,
  WorkspaceConfigurationVersion,
} from '../configuration/workspace-configuration.entity.js';

export interface CreateConfigurationVersionParams {
  verticalId: string;
  version: number;
  config: Readonly<Record<string, unknown>>;
  status: ConfigurationVersionStatus;
  editorId?: string | null;
  changeReason?: string | null;
}

export interface ConfigurationRepositoryPort {
  findById(id: string): Promise<WorkspaceConfigurationVersion | null>;
  findActiveByVertical(verticalId: string): Promise<WorkspaceConfigurationVersion | null>;
  findLatestDraft(verticalId: string): Promise<WorkspaceConfigurationVersion | null>;
  listByVertical(verticalId: string): Promise<readonly WorkspaceConfigurationVersion[]>;
  create(params: CreateConfigurationVersionParams): Promise<WorkspaceConfigurationVersion>;
  updateConfig(
    id: string,
    config: Readonly<Record<string, unknown>>,
    extras?: { editorId?: string | null; changeReason?: string | null },
  ): Promise<WorkspaceConfigurationVersion>;
  updateStatus(
    id: string,
    status: ConfigurationVersionStatus,
    extras?: { activatedAt?: Date | null; editorId?: string | null },
  ): Promise<WorkspaceConfigurationVersion>;
  markPreviousActiveRolledBack(verticalId: string, exceptId: string): Promise<void>;
}

export const CONFIGURATION_REPOSITORY_PORT = Symbol('EDGE_CONFIGURATION_REPOSITORY_PORT');
