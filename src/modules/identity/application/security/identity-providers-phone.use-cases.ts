import { createHash, randomInt } from 'node:crypto';
import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type {
  CreateKeycloakIdentityProviderInput,
  KeycloakAdminPort,
  KeycloakIdentityProvider,
  UpdateKeycloakIdentityProviderInput,
} from '../../domain/ports/keycloak-admin.port.js';
import type { UserPreferencesPort } from '../../../../core/domain/ports/user-preferences.port.js';
import type { WhatsAppOtpPort } from '../../domain/ports/whatsapp-otp.port.js';
import type { CacheService } from '../../../../shared/database/cache.service.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

const ALIAS_RE = /^[a-z0-9][a-z0-9_-]{1,35}$/;
const E164_RE = /^\+[1-9]\d{6,14}$/;
const OTP_TTL_SECONDS = 600;
const OTP_MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60;

function assertAlias(alias: string): string {
  const normalized = alias.trim().toLowerCase();
  if (!ALIAS_RE.test(normalized)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Alias must be 2–36 chars: lowercase letter/digit, then letters, digits, _ or -',
    );
  }
  return normalized;
}

function hashOtp(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

export class CreateIdentityProviderUseCase
  implements UseCase<{ ctx: ExecutionContext; input: CreateKeycloakIdentityProviderInput }, KeycloakIdentityProvider>
{
  constructor(private readonly keycloakAdmin: KeycloakAdminPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    input: CreateKeycloakIdentityProviderInput;
  }): Promise<KeycloakIdentityProvider> {
    requireSubject(input.ctx);
    if (!(await this.keycloakAdmin.isAvailable())) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Keycloak admin unavailable');
    }
    const alias = assertAlias(input.input.alias);
    const providerId = input.input.providerId.trim();
    if (!providerId) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'providerId is required');
    }
    return this.keycloakAdmin.createIdentityProvider({
      ...input.input,
      alias,
      providerId,
    });
  }
}

export class UpdateIdentityProviderUseCase
  implements UseCase<{ ctx: ExecutionContext; input: UpdateKeycloakIdentityProviderInput }, KeycloakIdentityProvider>
{
  constructor(private readonly keycloakAdmin: KeycloakAdminPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    input: UpdateKeycloakIdentityProviderInput;
  }): Promise<KeycloakIdentityProvider> {
    requireSubject(input.ctx);
    if (!(await this.keycloakAdmin.isAvailable())) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Keycloak admin unavailable');
    }
    const alias = assertAlias(input.input.alias);
    return this.keycloakAdmin.updateIdentityProvider({ ...input.input, alias });
  }
}

export class DeleteIdentityProviderUseCase
  implements UseCase<{ ctx: ExecutionContext; alias: string }, { deleted: true; alias: string }>
{
  constructor(private readonly keycloakAdmin: KeycloakAdminPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    alias: string;
  }): Promise<{ deleted: true; alias: string }> {
    requireSubject(input.ctx);
    if (!(await this.keycloakAdmin.isAvailable())) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Keycloak admin unavailable');
    }
    const alias = assertAlias(input.alias);
    const existing = await this.keycloakAdmin.getIdentityProvider(alias);
    if (!existing) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Identity provider not found');
    }
    await this.keycloakAdmin.deleteIdentityProvider(alias);
    return { deleted: true, alias };
  }
}

export class GetIdentityProviderUseCase
  implements UseCase<{ ctx: ExecutionContext; alias: string }, KeycloakIdentityProvider>
{
  constructor(private readonly keycloakAdmin: KeycloakAdminPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    alias: string;
  }): Promise<KeycloakIdentityProvider> {
    requireSubject(input.ctx);
    if (!(await this.keycloakAdmin.isAvailable())) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Keycloak admin unavailable');
    }
    const alias = assertAlias(input.alias);
    const provider = await this.keycloakAdmin.getIdentityProvider(alias);
    if (!provider) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Identity provider not found');
    }
    return provider;
  }
}

type PhoneOtpChallenge = {
  phoneE164: string;
  codeHash: string;
  salt: string;
  attempts: number;
  createdAt: string;
};

export class SendPhoneVerificationOtpUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; phoneE164: string },
      { sent: true; expiresInSeconds: number; dryRun?: boolean }
    >
{
  constructor(
    private readonly cache: CacheService,
    private readonly whatsapp: WhatsAppOtpPort,
    private readonly preferences: UserPreferencesPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    phoneE164: string;
  }): Promise<{ sent: true; expiresInSeconds: number; dryRun?: boolean }> {
    const ctx = requireSubject(input.ctx);
    const phone = input.phoneE164.trim();
    if (!E164_RE.test(phone)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Phone must be E.164 (e.g. +243970000000)',
      );
    }

    const cooldownKey = `phone-otp-cd:${ctx.subjectId}`;
    const cooling = await this.cache.get<string>('identity', cooldownKey);
    if (cooling) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Wait ${OTP_COOLDOWN_SECONDS}s before requesting another code`,
      );
    }

    const code = String(randomInt(100_000, 999_999));
    const salt = createHash('sha256')
      .update(`${ctx.tenantId}:${ctx.subjectId}:${Date.now()}`)
      .digest('hex')
      .slice(0, 16);
    const challenge: PhoneOtpChallenge = {
      phoneE164: phone,
      codeHash: hashOtp(code, salt),
      salt,
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    await this.cache.set(
      'identity',
      `phone-otp:${ctx.subjectId}`,
      challenge,
      OTP_TTL_SECONDS,
    );
    await this.cache.set('identity', cooldownKey, '1', OTP_COOLDOWN_SECONDS);

    await this.preferences.patchSettings(ctx.tenantId, ctx.subjectId, {
      'verification.phoneE164': phone,
      'verification.phoneVerified': false,
    });

    const expiresInMinutes = Math.floor(OTP_TTL_SECONDS / 60);
    const result = await this.whatsapp.sendOtp({
      toE164: phone,
      code,
      expiresInMinutes,
    });

    return {
      sent: true,
      expiresInSeconds: OTP_TTL_SECONDS,
      dryRun: result.dryRun === true,
    };
  }
}

export class VerifyPhoneVerificationOtpUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; phoneE164: string; code: string },
      { verified: true; phoneE164: string }
    >
{
  constructor(
    private readonly cache: CacheService,
    private readonly preferences: UserPreferencesPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    phoneE164: string;
    code: string;
  }): Promise<{ verified: true; phoneE164: string }> {
    const ctx = requireSubject(input.ctx);
    const phone = input.phoneE164.trim();
    const code = input.code.trim();
    if (!E164_RE.test(phone)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Phone must be E.164');
    }
    if (!/^\d{6}$/.test(code)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Code must be 6 digits');
    }

    const key = `phone-otp:${ctx.subjectId}`;
    const challenge = await this.cache.get<PhoneOtpChallenge>('identity', key);
    if (!challenge || challenge.phoneE164 !== phone) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'No active verification challenge');
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      await this.cache.del('identity', key);
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Too many attempts — request a new code');
    }

    const ok = hashOtp(code, challenge.salt) === challenge.codeHash;
    if (!ok) {
      await this.cache.set(
        'identity',
        key,
        { ...challenge, attempts: challenge.attempts + 1 },
        OTP_TTL_SECONDS,
      );
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid verification code');
    }

    await this.cache.del('identity', key);
    await this.preferences.patchSettings(ctx.tenantId, ctx.subjectId, {
      'verification.phoneE164': phone,
      'verification.phoneVerified': true,
    });
    return { verified: true, phoneE164: phone };
  }
}
