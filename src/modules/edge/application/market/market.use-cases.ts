import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertNoSegmentCycle,
  walkSegmentAncestors,
  type MarketSegment,
} from '../../domain/market/market-segment.entity.js';
import type { BusinessProfileTemplate } from '../../domain/market/business-profile.entity.js';
import type { OperatingModel } from '../../domain/market/operating-model.entity.js';
import type { SegmentRepositoryPort } from '../../domain/ports/segment-repository.port.js';
import type { ProfileRepositoryPort } from '../../domain/ports/profile-repository.port.js';
import type { OperatingModelRepositoryPort } from '../../domain/ports/operating-model-repository.port.js';
import type { VerticalRepositoryPort } from '../../domain/ports/vertical-repository.port.js';

export class CreateSegmentUseCase {
  constructor(
    private readonly segments: SegmentRepositoryPort,
    private readonly verticals: VerticalRepositoryPort,
  ) {}

  async execute(input: {
    code: string;
    name: string;
    description?: string | null;
    verticalId: string;
    parentSegmentId?: string | null;
    status?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MarketSegment> {
    const vertical = await this.verticals.findById(input.verticalId);
    if (!vertical) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    if (await this.segments.findByCode(input.code)) {
      throw new DomainError(ErrorCode.CONFLICT, 'Segment code already exists');
    }
    if (input.parentSegmentId) {
      const parent = await this.segments.findById(input.parentSegmentId);
      if (!parent) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Parent segment not found');
      const all = await this.segments.listByVertical(parent.verticalId);
      const byId = new Map(all.map((s) => [s.id, s]));
      const ancestors = walkSegmentAncestors(
        input.parentSegmentId,
        (id) => byId.get(id)?.parentSegmentId,
      );
      assertNoSegmentCycle('__new__', input.parentSegmentId, ancestors);
    }
    return this.segments.create(input);
  }
}

export class UpdateSegmentUseCase {
  constructor(private readonly segments: SegmentRepositoryPort) {}

  async execute(input: {
    id: string;
    name?: string;
    description?: string | null;
    parentSegmentId?: string | null;
    status?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MarketSegment> {
    const current = await this.segments.findById(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Segment not found');
    if (input.parentSegmentId !== undefined && input.parentSegmentId !== null) {
      const siblings = await this.segments.listByVertical(current.verticalId);
      const byId = new Map(siblings.map((s) => [s.id, s]));
      if (!byId.has(input.parentSegmentId)) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Parent segment not found');
      }
      const ancestors = walkSegmentAncestors(
        input.parentSegmentId,
        (id) => byId.get(id)?.parentSegmentId,
      );
      assertNoSegmentCycle(current.id, input.parentSegmentId, ancestors);
    }
    return this.segments.update(input.id, input);
  }
}

export class ListSegmentsByVerticalUseCase {
  constructor(private readonly segments: SegmentRepositoryPort) {}

  async execute(verticalId: string) {
    return this.segments.listByVertical(verticalId);
  }
}

export class GetSegmentUseCase {
  constructor(private readonly segments: SegmentRepositoryPort) {}

  async execute(id: string): Promise<MarketSegment> {
    const segment = await this.segments.findById(id);
    if (!segment) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Segment not found');
    return segment;
  }
}

export class CreateProfileUseCase {
  constructor(
    private readonly profiles: ProfileRepositoryPort,
    private readonly verticals: VerticalRepositoryPort,
  ) {}

  async execute(input: {
    code: string;
    name: string;
    description?: string | null;
    verticalId: string;
    segmentId?: string | null;
    status?: string;
    attributesSchema?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<BusinessProfileTemplate> {
    if (!(await this.verticals.findById(input.verticalId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    }
    if (await this.profiles.findByCode(input.code)) {
      throw new DomainError(ErrorCode.CONFLICT, 'Profile code already exists');
    }
    return this.profiles.create(input);
  }
}

export class ListProfilesUseCase {
  constructor(private readonly profiles: ProfileRepositoryPort) {}

  async execute(verticalId?: string) {
    return this.profiles.list(verticalId ? { verticalId } : undefined);
  }
}

export class GetProfileUseCase {
  constructor(private readonly profiles: ProfileRepositoryPort) {}

  async execute(id: string): Promise<BusinessProfileTemplate> {
    const profile = await this.profiles.findById(id);
    if (!profile) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Profile not found');
    return profile;
  }
}

export class CreateOperatingModelUseCase {
  constructor(private readonly models: OperatingModelRepositoryPort) {}

  async execute(input: {
    code: string;
    name: string;
    description?: string | null;
    dimension?: string | null;
    verticalId?: string | null;
    status?: string;
    metadata?: Record<string, unknown>;
  }): Promise<OperatingModel> {
    if (await this.models.findByCode(input.code)) {
      throw new DomainError(ErrorCode.CONFLICT, 'Operating model code already exists');
    }
    return this.models.create(input);
  }
}

export class ListOperatingModelsUseCase {
  constructor(private readonly models: OperatingModelRepositoryPort) {}

  async execute(verticalId?: string) {
    return this.models.list(verticalId ? { verticalId } : undefined);
  }
}

export class GetOperatingModelUseCase {
  constructor(private readonly models: OperatingModelRepositoryPort) {}

  async execute(id: string): Promise<OperatingModel> {
    const model = await this.models.findById(id);
    if (!model) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Operating model not found');
    return model;
  }
}
