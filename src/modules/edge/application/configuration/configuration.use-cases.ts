import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ConfigurationRepositoryPort } from '../../domain/ports/configuration-repository.port.js';
import type { VerticalRepositoryPort } from '../../domain/ports/vertical-repository.port.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import {
  assertConfigurationTransition,
  ConfigurationVersionStatus,
  validateConfigurationPayload,
  type WorkspaceConfigurationVersion,
} from '../../domain/configuration/workspace-configuration.entity.js';

export class GetWorkspaceConfigurationUseCase {
  constructor(private readonly configurations: ConfigurationRepositoryPort) {}

  async execute(verticalId: string) {
    const active = await this.configurations.findActiveByVertical(verticalId);
    const draft = await this.configurations.findLatestDraft(verticalId);
    return { active, draft };
  }
}

export class UpdateConfigurationDraftUseCase {
  constructor(
    private readonly configurations: ConfigurationRepositoryPort,
    private readonly verticals: VerticalRepositoryPort,
  ) {}

  async execute(input: {
    verticalId: string;
    actorId: string;
    config: Readonly<Record<string, unknown>>;
    changeReason?: string | null;
  }): Promise<WorkspaceConfigurationVersion> {
    const vertical = await this.verticals.findById(input.verticalId);
    if (!vertical) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    const validation = validateConfigurationPayload(input.config);
    if (!validation.valid) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid configuration payload', [
        { errors: validation.errors },
      ]);
    }
    const draft = await this.configurations.findLatestDraft(input.verticalId);
    if (draft && draft.status === ConfigurationVersionStatus.DRAFT) {
      return this.configurations.updateConfig(draft.id, input.config, {
        editorId: input.actorId,
        changeReason: input.changeReason,
      });
    }
    const history = await this.configurations.listByVertical(input.verticalId);
    const nextVersion = (history[0]?.version ?? 0) + 1;
    return this.configurations.create({
      verticalId: input.verticalId,
      version: nextVersion,
      config: input.config,
      status: ConfigurationVersionStatus.DRAFT,
      editorId: input.actorId,
      changeReason: input.changeReason,
    });
  }
}

export class ValidateConfigurationUseCase {
  constructor(private readonly configurations: ConfigurationRepositoryPort) {}

  async execute(input: { verticalId: string; actorId: string }) {
    const draft = await this.configurations.findLatestDraft(input.verticalId);
    if (!draft) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'No draft configuration');
    const validation = validateConfigurationPayload(draft.config);
    if (!validation.valid) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Configuration validation failed', [
        { errors: validation.errors },
      ]);
    }
    assertConfigurationTransition(draft.status, ConfigurationVersionStatus.VALIDATED);
    return this.configurations.updateStatus(draft.id, ConfigurationVersionStatus.VALIDATED, {
      editorId: input.actorId,
    });
  }
}

export class ActivateConfigurationUseCase {
  constructor(
    private readonly configurations: ConfigurationRepositoryPort,
    private readonly verticals: VerticalRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { verticalId: string; actorId: string }) {
    const draft = await this.configurations.findLatestDraft(input.verticalId);
    if (!draft) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'No draft configuration');
    let current = draft;
    if (current.status === ConfigurationVersionStatus.DRAFT) {
      assertConfigurationTransition(current.status, ConfigurationVersionStatus.VALIDATED);
      current = await this.configurations.updateStatus(
        current.id,
        ConfigurationVersionStatus.VALIDATED,
        { editorId: input.actorId },
      );
    }
    assertConfigurationTransition(current.status, ConfigurationVersionStatus.ACTIVE);
    await this.configurations.markPreviousActiveRolledBack(input.verticalId, current.id);
    const activated = await this.configurations.updateStatus(
      current.id,
      ConfigurationVersionStatus.ACTIVE,
      { activatedAt: new Date(), editorId: input.actorId },
    );
    await this.verticals.update(input.verticalId, {
      configurationVersion: activated.version,
      updatedBy: input.actorId,
    });
    await this.audit.create({
      eventType: 'edge.configuration.activated',
      actorId: input.actorId,
      subjectType: 'configuration',
      subjectId: activated.id,
      verticalId: input.verticalId,
      details: { version: activated.version },
    });
    return activated;
  }
}

export class ListConfigurationHistoryUseCase {
  constructor(private readonly configurations: ConfigurationRepositoryPort) {}

  async execute(verticalId: string) {
    return this.configurations.listByVertical(verticalId);
  }
}
