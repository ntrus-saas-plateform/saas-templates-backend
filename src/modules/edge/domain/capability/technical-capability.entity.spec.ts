import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  assertNoCapabilityDependencyCycle,
  wouldCreateCapabilityDependencyCycle,
} from './technical-capability.entity.js';

describe('Capability dependency cycle detection', () => {
  it('detects direct self-cycle', () => {
    expect(wouldCreateCapabilityDependencyCycle([], 'a', 'a')).toBe(true);
  });

  it('detects A→B→A cycle', () => {
    const edges = [{ capabilityId: 'b', dependsOnCapabilityId: 'a' }];
    expect(wouldCreateCapabilityDependencyCycle(edges, 'a', 'b')).toBe(true);
    expect(() => assertNoCapabilityDependencyCycle(edges, 'a', 'b')).toThrow(DomainError);
  });

  it('allows acyclic graph', () => {
    const edges = [
      { capabilityId: 'a', dependsOnCapabilityId: 'b' },
      { capabilityId: 'b', dependsOnCapabilityId: 'c' },
    ];
    expect(wouldCreateCapabilityDependencyCycle(edges, 'a', 'd')).toBe(false);
    expect(() => assertNoCapabilityDependencyCycle(edges, 'a', 'd')).not.toThrow();
  });
});
