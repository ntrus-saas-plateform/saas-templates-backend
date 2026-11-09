import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertVerticalTransition,
  evaluateVerticalReadiness,
  VerticalStatus,
  type Vertical,
} from '../../domain/vertical/vertical.entity.js';
import type { VerticalRepositoryPort } from '../../domain/ports/vertical-repository.port.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import type { VerticalLifecycleRepositoryPort } from '../../domain/ports/vertical-lifecycle-repository.port.js';

async function recordLifecycle(
  lifecycle: VerticalLifecycleRepositoryPort | undefined,
  input: {
    verticalId: string;
    fromStatus: VerticalStatus;
    toStatus: VerticalStatus;
    reason?: string | null;
    actorId?: string | null;
  },
): Promise<void> {
  if (!lifecycle) return;
  await lifecycle.record(input);
}

export class CreateVerticalUseCase {
  constructor(
    private readonly verticals: VerticalRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    slug: string;
    displayName: string;
    description?: string | null;
    iconRef?: string | null;
    visualIdentityRef?: string | null;
    keycloakOrganizationId?: string | null;
  }): Promise<Vertical> {
    const existingCode = await this.verticals.findByCode(input.code);
    if (existingCode) throw new DomainError(ErrorCode.CONFLICT, 'Vertical code already exists');
    const existingSlug = await this.verticals.findBySlug(input.slug);
    if (existingSlug) throw new DomainError(ErrorCode.CONFLICT, 'Vertical slug already exists');

    const vertical = await this.verticals.create({
      code: input.code,
      slug: input.slug,
      displayName: input.displayName,
      description: input.description,
      iconRef: input.iconRef,
      visualIdentityRef: input.visualIdentityRef,
      keycloakOrganizationId: input.keycloakOrganizationId,
      createdBy: input.actorId,
    });
    await this.audit.create({
      eventType: 'edge.vertical.created',
      actorId: input.actorId,
      subjectType: 'vertical',
      subjectId: vertical.id,
      verticalId: vertical.id,
    });
    return vertical;
  }
}

export class UpdateVerticalUseCase {
  constructor(private readonly verticals: VerticalRepositoryPort) {}

  async execute(input: {
    id: string;
    actorId: string;
    displayName?: string;
    description?: string | null;
    iconRef?: string | null;
    visualIdentityRef?: string | null;
    keycloakOrganizationId?: string | null;
  }): Promise<Vertical> {
    const current = await this.verticals.findById(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    if (
      current.status === VerticalStatus.DEACTIVATED ||
      current.status === VerticalStatus.DEACTIVATION_PENDING
    ) {
      throw new DomainError(ErrorCode.CONFLICT, 'Cannot update a deactivating/deactivated vertical');
    }
    let nextStatus = current.status;
    if (current.status === VerticalStatus.DRAFT) {
      nextStatus = VerticalStatus.CONFIGURING;
      assertVerticalTransition(current.status, nextStatus);
    }
    const updated = await this.verticals.update(input.id, {
      displayName: input.displayName,
      description: input.description,
      iconRef: input.iconRef,
      visualIdentityRef: input.visualIdentityRef,
      keycloakOrganizationId: input.keycloakOrganizationId,
      updatedBy: input.actorId,
    });
    if (nextStatus !== current.status) {
      return this.verticals.updateStatus(updated.id, nextStatus, { updatedBy: input.actorId });
    }
    return updated;
  }
}

export class GetVerticalUseCase {
  constructor(private readonly verticals: VerticalRepositoryPort) {}

  async execute(id: string): Promise<Vertical> {
    const vertical = await this.verticals.findById(id);
    if (!vertical) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    return vertical;
  }
}

export class ListVerticalsUseCase {
  constructor(private readonly verticals: VerticalRepositoryPort) {}

  async execute(input: {
    page: number;
    limit: number;
    status?: VerticalStatus;
    search?: string;
  }) {
    return this.verticals.list(input);
  }
}

export class CheckVerticalReadinessUseCase {
  constructor(private readonly verticals: VerticalRepositoryPort) {}

  async execute(id: string) {
    const vertical = await this.verticals.findById(id);
    if (!vertical) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    const readiness = evaluateVerticalReadiness(vertical);
    if (
      readiness.ready &&
      (vertical.status === VerticalStatus.CONFIGURING || vertical.status === VerticalStatus.DRAFT)
    ) {
      assertVerticalTransition(vertical.status, VerticalStatus.READY_FOR_ACTIVATION);
      await this.verticals.updateStatus(vertical.id, VerticalStatus.READY_FOR_ACTIVATION);
    }
    return { verticalId: id, ...readiness, status: (await this.verticals.findById(id))?.status };
  }
}

export class ActivateVerticalUseCase {
  constructor(
    private readonly verticals: VerticalRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
    private readonly lifecycle?: VerticalLifecycleRepositoryPort,
  ) {}

  async execute(input: { id: string; actorId: string }): Promise<Vertical> {
    const vertical = await this.verticals.findById(input.id);
    if (!vertical) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    const readiness = evaluateVerticalReadiness(vertical);
    if (!readiness.ready) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Vertical is not ready for activation', [
        { missing: readiness.missing },
      ]);
    }
    let current = vertical;
    if (current.status !== VerticalStatus.READY_FOR_ACTIVATION) {
      assertVerticalTransition(current.status, VerticalStatus.READY_FOR_ACTIVATION);
      current = await this.verticals.updateStatus(
        current.id,
        VerticalStatus.READY_FOR_ACTIVATION,
        { updatedBy: input.actorId },
      );
      await recordLifecycle(this.lifecycle, {
        verticalId: current.id,
        fromStatus: vertical.status,
        toStatus: VerticalStatus.READY_FOR_ACTIVATION,
        actorId: input.actorId,
      });
    }
    assertVerticalTransition(current.status, VerticalStatus.ACTIVE);
    const from = current.status;
    const updated = await this.verticals.updateStatus(current.id, VerticalStatus.ACTIVE, {
      activatedAt: new Date(),
      updatedBy: input.actorId,
    });
    await recordLifecycle(this.lifecycle, {
      verticalId: updated.id,
      fromStatus: from,
      toStatus: VerticalStatus.ACTIVE,
      actorId: input.actorId,
    });
    await this.audit.create({
      eventType: 'edge.vertical.activated',
      actorId: input.actorId,
      subjectType: 'vertical',
      subjectId: updated.id,
      verticalId: updated.id,
    });
    return updated;
  }
}

export class SuspendVerticalUseCase {
  constructor(
    private readonly verticals: VerticalRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
    private readonly lifecycle?: VerticalLifecycleRepositoryPort,
  ) {}

  async execute(input: { id: string; actorId: string; reason?: string }): Promise<Vertical> {
    const vertical = await this.verticals.findById(input.id);
    if (!vertical) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    assertVerticalTransition(vertical.status, VerticalStatus.SUSPENDED);
    const updated = await this.verticals.updateStatus(vertical.id, VerticalStatus.SUSPENDED, {
      suspensionReason: input.reason ?? null,
      suspendedAt: new Date(),
      updatedBy: input.actorId,
    });
    await recordLifecycle(this.lifecycle, {
      verticalId: updated.id,
      fromStatus: vertical.status,
      toStatus: VerticalStatus.SUSPENDED,
      reason: input.reason,
      actorId: input.actorId,
    });
    await this.audit.create({
      eventType: 'edge.vertical.suspended',
      actorId: input.actorId,
      subjectType: 'vertical',
      subjectId: updated.id,
      verticalId: updated.id,
      details: { reason: input.reason ?? null },
    });
    return updated;
  }
}

export class ReinstateVerticalUseCase {
  constructor(
    private readonly verticals: VerticalRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
    private readonly lifecycle?: VerticalLifecycleRepositoryPort,
  ) {}

  async execute(input: { id: string; actorId: string }): Promise<Vertical> {
    const vertical = await this.verticals.findById(input.id);
    if (!vertical) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    assertVerticalTransition(vertical.status, VerticalStatus.ACTIVE);
    const updated = await this.verticals.updateStatus(vertical.id, VerticalStatus.ACTIVE, {
      suspensionReason: null,
      suspendedAt: null,
      updatedBy: input.actorId,
    });
    await recordLifecycle(this.lifecycle, {
      verticalId: updated.id,
      fromStatus: vertical.status,
      toStatus: VerticalStatus.ACTIVE,
      actorId: input.actorId,
    });
    await this.audit.create({
      eventType: 'edge.vertical.reinstated',
      actorId: input.actorId,
      subjectType: 'vertical',
      subjectId: updated.id,
      verticalId: updated.id,
    });
    return updated;
  }
}

export class DeactivateVerticalUseCase {
  constructor(
    private readonly verticals: VerticalRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
    private readonly lifecycle?: VerticalLifecycleRepositoryPort,
  ) {}

  async execute(input: { id: string; actorId: string; reason?: string }): Promise<Vertical> {
    const vertical = await this.verticals.findById(input.id);
    if (!vertical) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    let current = vertical;
    if (current.status !== VerticalStatus.DEACTIVATION_PENDING) {
      assertVerticalTransition(current.status, VerticalStatus.DEACTIVATION_PENDING);
      const from = current.status;
      current = await this.verticals.updateStatus(
        current.id,
        VerticalStatus.DEACTIVATION_PENDING,
        { updatedBy: input.actorId, suspensionReason: input.reason ?? null },
      );
      await recordLifecycle(this.lifecycle, {
        verticalId: current.id,
        fromStatus: from,
        toStatus: VerticalStatus.DEACTIVATION_PENDING,
        reason: input.reason,
        actorId: input.actorId,
      });
    }
    assertVerticalTransition(current.status, VerticalStatus.DEACTIVATED);
    const from = current.status;
    const updated = await this.verticals.updateStatus(current.id, VerticalStatus.DEACTIVATED, {
      deactivatedAt: new Date(),
      updatedBy: input.actorId,
    });
    await recordLifecycle(this.lifecycle, {
      verticalId: updated.id,
      fromStatus: from,
      toStatus: VerticalStatus.DEACTIVATED,
      reason: input.reason,
      actorId: input.actorId,
    });
    await this.audit.create({
      eventType: 'edge.vertical.deactivated',
      actorId: input.actorId,
      subjectType: 'vertical',
      subjectId: updated.id,
      verticalId: updated.id,
    });
    return updated;
  }
}

export class DeprecateVerticalUseCase {
  constructor(
    private readonly verticals: VerticalRepositoryPort,
    private readonly lifecycle: VerticalLifecycleRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { id: string; actorId: string; reason?: string }): Promise<Vertical> {
    const vertical = await this.verticals.findById(input.id);
    if (!vertical) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    assertVerticalTransition(vertical.status, VerticalStatus.DEPRECATED);
    const updated = await this.verticals.updateStatus(vertical.id, VerticalStatus.DEPRECATED, {
      suspensionReason: input.reason ?? null,
      updatedBy: input.actorId,
    });
    await this.lifecycle.record({
      verticalId: updated.id,
      fromStatus: vertical.status,
      toStatus: VerticalStatus.DEPRECATED,
      reason: input.reason,
      actorId: input.actorId,
    });
    await this.audit.create({
      eventType: 'edge.vertical.deprecated',
      actorId: input.actorId,
      subjectType: 'vertical',
      subjectId: updated.id,
      verticalId: updated.id,
      details: { reason: input.reason ?? null },
    });
    return updated;
  }
}

export class RetireVerticalUseCase {
  constructor(
    private readonly verticals: VerticalRepositoryPort,
    private readonly lifecycle: VerticalLifecycleRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { id: string; actorId: string; reason?: string }): Promise<Vertical> {
    const vertical = await this.verticals.findById(input.id);
    if (!vertical) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    assertVerticalTransition(vertical.status, VerticalStatus.RETIRED);
    const updated = await this.verticals.updateStatus(vertical.id, VerticalStatus.RETIRED, {
      suspensionReason: input.reason ?? null,
      updatedBy: input.actorId,
    });
    await this.lifecycle.record({
      verticalId: updated.id,
      fromStatus: vertical.status,
      toStatus: VerticalStatus.RETIRED,
      reason: input.reason,
      actorId: input.actorId,
    });
    await this.audit.create({
      eventType: 'edge.vertical.retired',
      actorId: input.actorId,
      subjectType: 'vertical',
      subjectId: updated.id,
      verticalId: updated.id,
    });
    return updated;
  }
}

export class ArchiveVerticalUseCase {
  constructor(
    private readonly verticals: VerticalRepositoryPort,
    private readonly lifecycle: VerticalLifecycleRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { id: string; actorId: string; reason?: string }): Promise<Vertical> {
    const vertical = await this.verticals.findById(input.id);
    if (!vertical) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    assertVerticalTransition(vertical.status, VerticalStatus.ARCHIVED);
    const updated = await this.verticals.updateStatus(vertical.id, VerticalStatus.ARCHIVED, {
      suspensionReason: input.reason ?? null,
      updatedBy: input.actorId,
    });
    await this.lifecycle.record({
      verticalId: updated.id,
      fromStatus: vertical.status,
      toStatus: VerticalStatus.ARCHIVED,
      reason: input.reason,
      actorId: input.actorId,
    });
    await this.audit.create({
      eventType: 'edge.vertical.archived',
      actorId: input.actorId,
      subjectType: 'vertical',
      subjectId: updated.id,
      verticalId: updated.id,
    });
    return updated;
  }
}

export class GetVerticalHistoryUseCase {
  constructor(private readonly audit: AuditEventRepositoryPort) {}

  async execute(verticalId: string, page = 1, limit = 50) {
    return this.audit.list({ page, limit, verticalId });
  }
}

export class GetVerticalLifecycleEventsUseCase {
  constructor(private readonly lifecycle: VerticalLifecycleRepositoryPort) {}

  async execute(verticalId: string, page = 1, limit = 50) {
    return this.lifecycle.listByVertical(verticalId, page, limit);
  }
}
