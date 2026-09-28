import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type { UserPreferencesPort } from '../../../../core/domain/ports/user-preferences.port.js';
import { validateUserPreferencePatch } from '../../domain/user/user-preferences.schema.js';
import type { ConfigurationResolverPort } from '../../domain/ports/configuration-resolver.port.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ZodError } from 'zod';

export class GetMyPreferencesUseCase
  implements UseCase<{ ctx: ExecutionContext }, Record<string, unknown>>
{
  constructor(
    private readonly userPreferences: UserPreferencesPort,
    private readonly configurationResolver: ConfigurationResolverPort,
  ) {}

  async execute(input: { ctx: ExecutionContext }): Promise<Record<string, unknown>> {
    const ctx = requireSubject(input.ctx);
    const userSettings = await this.userPreferences.getSettings(ctx.tenantId, ctx.subjectId);

    const namespaces = [
      'localization',
      'currency',
      'ui',
      'defaults',
      'tables',
      'notifications',
      'accessibility',
    ] as const;

    const resolved: Record<string, unknown> = { ...userSettings };
    for (const ns of namespaces) {
      const values = await this.configurationResolver.resolveNamespace(ns, {
        tenantId: ctx.tenantId,
        organizationId: ctx.organizationId,
        userSettings,
      });
      for (const [key, value] of Object.entries(values)) {
        const fullKey = `${ns}.${key}`;
        if (resolved[fullKey] === undefined) {
          resolved[fullKey] = value;
        }
      }
    }
    return resolved;
  }
}

export class UpdateMyPreferencesUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; settings: Record<string, unknown> },
      Record<string, unknown>
    >
{
  constructor(private readonly userPreferences: UserPreferencesPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    settings: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    const ctx = requireSubject(input.ctx);
    let validated: Record<string, unknown>;
    try {
      validated = validateUserPreferencePatch(input.settings);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid preference values',
          error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        );
      }
      throw error;
    }
    return this.userPreferences.patchSettings(
      ctx.tenantId,
      ctx.subjectId,
      validated,
      undefined,
      ctx.organizationId,
    );
  }
}
