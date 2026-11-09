import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  assertValidStudioDocument,
  emptyStudioDocument,
  extractStudioDocument,
} from './marketing-studio.blocks.js';

describe('marketing studio blocks', () => {
  it('accepts a valid v1 document', () => {
    const doc = assertValidStudioDocument({
      version: 1,
      blocks: [
        { id: 'hero-1', type: 'HERO', props: { headline: 'Hello' } },
        { id: 'cta-1', type: 'CTA', props: { label: 'Start' } },
      ],
    });
    expect(doc.blocks).toHaveLength(2);
  });

  it('rejects unknown block types', () => {
    expect(() =>
      assertValidStudioDocument({
        version: 1,
        blocks: [{ id: 'x', type: 'VIDEO_CAROUSEL', props: {} }],
      }),
    ).toThrow(DomainError);
  });

  it('rejects duplicate ids', () => {
    expect(() =>
      assertValidStudioDocument({
        version: 1,
        blocks: [
          { id: 'a', type: 'DIVIDER', props: {} },
          { id: 'a', type: 'DIVIDER', props: {} },
        ],
      }),
    ).toThrow(DomainError);
  });

  it('extracts studio from content body wrapper', () => {
    const doc = extractStudioDocument({
      studio: emptyStudioDocument(),
    });
    expect(doc?.version).toBe(1);
  });
});
