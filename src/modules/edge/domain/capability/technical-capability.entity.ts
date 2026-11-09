import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum CapabilityDependencyKind {
  REQUIRED = 'REQUIRED',
  OPTIONAL = 'OPTIONAL',
  MUTUALLY_EXCLUSIVE = 'MUTUALLY_EXCLUSIVE',
}

export enum CapabilityMappingClassification {
  REQUIRED = 'REQUIRED',
  OPTIONAL = 'OPTIONAL',
  SUPPORTED = 'SUPPORTED',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  PLANNED = 'PLANNED',
  DEPRECATED = 'DEPRECATED',
}

export interface TechnicalCapability {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly technicalStatus: string | null;
  readonly commercialAvailability: string | null;
  readonly ownerRef: string | null;
  readonly version: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CapabilityDependency {
  readonly id: string;
  readonly capabilityId: string;
  readonly dependsOnCapabilityId: string;
  readonly dependencyKind: CapabilityDependencyKind;
  readonly minVersion: string | null;
  readonly createdAt: Date;
}

export interface ProductCapabilityMapping {
  readonly id: string;
  readonly productId: string;
  readonly productVersionId: string | null;
  readonly capabilityId: string;
  readonly classification: CapabilityMappingClassification;
  readonly technicalStatus: string | null;
  readonly commercialAvailability: string | null;
  readonly restrictions: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Detects whether adding edge `fromId → toId` would create a cycle given
 * existing directed edges (capability depends_on dependsOn).
 */
export function wouldCreateCapabilityDependencyCycle(
  edges: ReadonlyArray<{ capabilityId: string; dependsOnCapabilityId: string }>,
  fromId: string,
  toId: string,
): boolean {
  if (fromId === toId) return true;
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const list = adjacency.get(e.capabilityId) ?? [];
    list.push(e.dependsOnCapabilityId);
    adjacency.set(e.capabilityId, list);
  }
  const proposed = adjacency.get(fromId) ?? [];
  proposed.push(toId);
  adjacency.set(fromId, proposed);

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const dfs = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  return dfs(fromId);
}

export function assertNoCapabilityDependencyCycle(
  edges: ReadonlyArray<{ capabilityId: string; dependsOnCapabilityId: string }>,
  fromId: string,
  toId: string,
): void {
  if (wouldCreateCapabilityDependencyCycle(edges, fromId, toId)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Capability dependency would create a cycle',
      [{ capabilityId: fromId, dependsOnCapabilityId: toId }],
    );
  }
}
