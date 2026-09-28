import { randomUUID } from 'node:crypto';
import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import type { SettingsRepositoryPort } from '../../domain/ports/settings-repository.port.js';
import type { OrganizationRepositoryPort } from '../../domain/ports/organization-repository.port.js';
import type { ConfigurationResolverPort } from '../../domain/ports/configuration-resolver.port.js';
import type { OutboxTransactionService } from '../../../../shared/messaging/outbox-transaction.service.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  SETTING_DEFINITIONS,
  validateSettingValue,
  getNamespaceSettingKeys,
} from '../../domain/configuration/setting-definition.js';

function maskSensitiveNamespace(
  namespace: string,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const masked = { ...values };
  for (const fullKey of getNamespaceSettingKeys(namespace)) {
    const definition = SETTING_DEFINITIONS[fullKey];
    if (!definition?.sensitive) continue;
    const shortKey = fullKey.slice(namespace.length + 1);
    if (masked[shortKey] !== undefined) {
      masked[shortKey] = '[protected]';
    }
  }
  return masked;
}

function createSettingsUpdatedEvent(
  ctx: ExecutionContext,
  namespace: string,
  organizationId?: string | null,
): IntegrationEvent<{ namespace: string }> {
  return {
    eventId: randomUUID(),
    eventType: 'settings.updated.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: ctx.tenantId,
    organizationId: organizationId ?? ctx.organizationId,
    correlationId: ctx.correlationId,
    causationId: null,
    traceId: ctx.traceId,
    actor: { type: 'user', id: ctx.subjectId },
    source: 'platform-core',
    payload: { namespace },
  };
}

export class GetTenantSettingsNamespaceUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; namespace: string },
      { namespace: string; values: Record<string, unknown> }
    >
{
  constructor(private readonly configurationResolver: ConfigurationResolverPort) {}

  async execute(input: { ctx: ExecutionContext; namespace: string }): Promise<{
    namespace: string;
    values: Record<string, unknown>;
  }> {
    const values = await this.configurationResolver.resolveNamespace(input.namespace, {
      tenantId: input.ctx.tenantId,
      organizationId: input.ctx.organizationId,
    });
    return {
      namespace: input.namespace,
      values: maskSensitiveNamespace(input.namespace, values),
    };
  }
}

export class UpdateTenantSettingsNamespaceUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; namespace: string; values: Record<string, unknown> },
      { namespace: string; values: Record<string, unknown> }
    >
{
  constructor(
    private readonly settings: SettingsRepositoryPort,
    private readonly configurationResolver: ConfigurationResolverPort,
    private readonly outboxTransaction: OutboxTransactionService,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    namespace: string;
    values: Record<string, unknown>;
  }): Promise<{ namespace: string; values: Record<string, unknown> }> {
    await this.outboxTransaction.runWithOutbox(input.ctx.tenantId, async (client, enqueue) => {
      for (const [key, value] of Object.entries(input.values)) {
        const fullKey = `${input.namespace}.${key}`;
        const validated = validateSettingValue(fullKey, value);
        const definition = SETTING_DEFINITIONS[fullKey];
        if (definition?.sensitive) {
          if (typeof validated !== 'string' || !validated.startsWith('secret://')) {
            throw new DomainError(
              ErrorCode.VALIDATION_ERROR,
              `Sensitive setting ${fullKey} requires a secret:// reference`,
            );
          }
          await this.settings.setTenantSetting(
            input.ctx.tenantId,
            input.namespace,
            key,
            validated,
            'secret',
            client,
          );
        } else {
          await this.settings.setTenantSetting(
            input.ctx.tenantId,
            input.namespace,
            key,
            validated,
            'normal',
            client,
          );
        }
      }

      await enqueue(createSettingsUpdatedEvent(input.ctx, input.namespace));
    });

    const values = await this.configurationResolver.resolveNamespace(input.namespace, {
      tenantId: input.ctx.tenantId,
      organizationId: input.ctx.organizationId,
    });
    return {
      namespace: input.namespace,
      values: maskSensitiveNamespace(input.namespace, values),
    };
  }
}

export class GetOrganizationSettingsNamespaceUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; organizationId: string; namespace: string },
      { organizationId: string; namespace: string; values: Record<string, unknown> }
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly configurationResolver: ConfigurationResolverPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
    namespace: string;
  }): Promise<{ organizationId: string; namespace: string; values: Record<string, unknown> }> {
    const org = await this.organizationRepository.findById(
      input.ctx.tenantId,
      input.organizationId,
    );
    if (!org) throw accessDeniedError();

    const values = await this.configurationResolver.resolveNamespace(input.namespace, {
      tenantId: input.ctx.tenantId,
      organizationId: input.organizationId,
    });
    return {
      organizationId: input.organizationId,
      namespace: input.namespace,
      values: maskSensitiveNamespace(input.namespace, values),
    };
  }
}

export class UpdateOrganizationSettingsNamespaceUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
        namespace: string;
        values: Record<string, unknown>;
      },
      { organizationId: string; namespace: string; values: Record<string, unknown> }
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly settings: SettingsRepositoryPort,
    private readonly configurationResolver: ConfigurationResolverPort,
    private readonly outboxTransaction: OutboxTransactionService,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
    namespace: string;
    values: Record<string, unknown>;
  }): Promise<{ organizationId: string; namespace: string; values: Record<string, unknown> }> {
    const org = await this.organizationRepository.findById(
      input.ctx.tenantId,
      input.organizationId,
    );
    if (!org) throw accessDeniedError();

    await this.outboxTransaction.runWithOutbox(input.ctx.tenantId, async (client, enqueue) => {
      for (const [key, value] of Object.entries(input.values)) {
        const fullKey = `${input.namespace}.${key}`;
        const validated = validateSettingValue(fullKey, value);
        await this.settings.setOrganizationSetting(
          input.ctx.tenantId,
          input.organizationId,
          input.namespace,
          key,
          validated,
          client,
        );
      }

      await enqueue(
        createSettingsUpdatedEvent(input.ctx, input.namespace, input.organizationId),
      );
    });

    const values = await this.configurationResolver.resolveNamespace(input.namespace, {
      tenantId: input.ctx.tenantId,
      organizationId: input.organizationId,
    });
    return {
      organizationId: input.organizationId,
      namespace: input.namespace,
      values: maskSensitiveNamespace(input.namespace, values),
    };
  }
}
