import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { WorkspaceSessionRepositoryPort } from '../../domain/ports/workspace-session-repository.port.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import type { AdministratorRepositoryPort } from '../../domain/ports/administrator-repository.port.js';
import type { EmergencyAccessRepositoryPort } from '../../domain/ports/emergency-access-repository.port.js';
import type { DelegationRepositoryPort } from '../../domain/ports/delegation-repository.port.js';
import {
  assertEmergencyAccessTransition,
  EmergencyAccessStatus,
} from '../../domain/emergency/edge-emergency-access.entity.js';
import { WorkspaceSessionStatus } from '../../domain/session/workspace-session.entity.js';

export class ListSecuritySessionsUseCase {
  constructor(private readonly sessions: WorkspaceSessionRepositoryPort) {}

  async execute(administratorId: string) {
    return this.sessions.listByAdministrator(administratorId);
  }
}

export class RevokeSecuritySessionUseCase {
  constructor(private readonly sessions: WorkspaceSessionRepositoryPort) {}

  async execute(input: { sessionId: string; actorId: string; reason?: string }) {
    const session = await this.sessions.findById(input.sessionId);
    if (!session) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Session not found');
    return this.sessions.updateStatus(session.id, WorkspaceSessionStatus.REVOKED, {
      revokedAt: new Date(),
      revocationReason: input.reason ?? `revoked-by:${input.actorId}`,
    });
  }
}

export class RevokeAllSecuritySessionsUseCase {
  constructor(private readonly sessions: WorkspaceSessionRepositoryPort) {}

  async execute(administratorId: string, reason = 'security-revoke-all') {
    return this.sessions.revokeAllForAdministrator(administratorId, reason);
  }
}

export class ListSecurityAuditEventsUseCase {
  constructor(private readonly audit: AuditEventRepositoryPort) {}

  async execute(input: {
    page: number;
    limit: number;
    eventType?: string;
    actorId?: string;
    verticalId?: string;
  }) {
    return this.audit.list(input);
  }
}

export class GetMfaStateUseCase {
  constructor(private readonly administrators: AdministratorRepositoryPort) {}

  async execute(administratorId: string) {
    const admin = await this.administrators.findById(administratorId);
    if (!admin) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Administrator not found');
    return {
      administratorId: admin.id,
      mfaEnrolled: admin.mfaEnrolled,
      emailVerified: admin.emailVerified,
    };
  }
}

export class RequestEmergencyAccessUseCase {
  constructor(
    private readonly emergency: EmergencyAccessRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    requesterId: string;
    justification: string;
    scope?: Readonly<Record<string, unknown>>;
  }) {
    const grant = await this.emergency.create({
      requesterId: input.requesterId,
      justification: input.justification,
      scope: input.scope ?? {},
    });
    await this.audit.create({
      eventType: 'edge.emergency.requested',
      actorId: input.requesterId,
      subjectType: 'emergency-access',
      subjectId: grant.id,
    });
    return grant;
  }
}

export class ApproveEmergencyAccessUseCase {
  constructor(
    private readonly emergency: EmergencyAccessRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    id: string;
    approverId: string;
    ttlMinutes?: number;
  }) {
    const grant = await this.emergency.findById(input.id);
    if (!grant) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Emergency access not found');
    assertEmergencyAccessTransition(grant.status, EmergencyAccessStatus.APPROVED);
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + (input.ttlMinutes ?? 60) * 60 * 1000);
    let updated = await this.emergency.updateStatus(grant.id, EmergencyAccessStatus.APPROVED, {
      approverId: input.approverId,
      startsAt,
      expiresAt,
    });
    assertEmergencyAccessTransition(updated.status, EmergencyAccessStatus.ACTIVE);
    updated = await this.emergency.updateStatus(updated.id, EmergencyAccessStatus.ACTIVE, {
      startsAt,
      expiresAt,
    });
    await this.audit.create({
      eventType: 'edge.emergency.approved',
      actorId: input.approverId,
      subjectType: 'emergency-access',
      subjectId: updated.id,
    });
    return updated;
  }
}

export class RevokeEmergencyAccessUseCase {
  constructor(
    private readonly emergency: EmergencyAccessRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { id: string; actorId: string }) {
    const grant = await this.emergency.findById(input.id);
    if (!grant) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Emergency access not found');
    assertEmergencyAccessTransition(grant.status, EmergencyAccessStatus.REVOKED);
    const updated = await this.emergency.updateStatus(grant.id, EmergencyAccessStatus.REVOKED, {
      revokedAt: new Date(),
    });
    await this.audit.create({
      eventType: 'edge.emergency.revoked',
      actorId: input.actorId,
      subjectType: 'emergency-access',
      subjectId: updated.id,
    });
    return updated;
  }
}

export class ListDelegationsUseCase {
  constructor(private readonly delegations: DelegationRepositoryPort) {}

  async execute(administratorId: string) {
    return this.delegations.listForAdministrator(administratorId);
  }
}

export class CreateDelegationUseCase {
  constructor(
    private readonly delegations: DelegationRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    grantorId: string;
    granteeId: string;
    scope: Readonly<Record<string, unknown>>;
    permittedOperations: readonly string[];
    expiresAt: Date;
    justification?: string | null;
  }) {
    const delegation = await this.delegations.create({
      grantorId: input.grantorId,
      granteeId: input.granteeId,
      scope: input.scope,
      permittedOperations: input.permittedOperations,
      startsAt: new Date(),
      expiresAt: input.expiresAt,
      justification: input.justification,
    });
    await this.audit.create({
      eventType: 'edge.delegation.created',
      actorId: input.grantorId,
      subjectType: 'delegation',
      subjectId: delegation.id,
    });
    return delegation;
  }
}

export class RevokeDelegationUseCase {
  constructor(
    private readonly delegations: DelegationRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { id: string; actorId: string }) {
    const updated = await this.delegations.revoke(input.id);
    await this.audit.create({
      eventType: 'edge.delegation.revoked',
      actorId: input.actorId,
      subjectType: 'delegation',
      subjectId: updated.id,
    });
    return updated;
  }
}
