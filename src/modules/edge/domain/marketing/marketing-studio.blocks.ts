import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export const STUDIO_BLOCK_TYPES = [
  'HERO',
  'RICH_TEXT',
  'CTA',
  'FORM_EMBED',
  'IMAGE',
  'DIVIDER',
] as const;

export type StudioBlockType = (typeof STUDIO_BLOCK_TYPES)[number];

export type StudioBlock = {
  readonly id: string;
  readonly type: StudioBlockType;
  readonly props: Record<string, unknown>;
};

export type StudioDocument = {
  readonly version: 1;
  readonly blocks: readonly StudioBlock[];
};

const BLOCK_ID_RE = /^[a-zA-Z0-9_-]{2,64}$/;

export function assertValidStudioDocument(input: unknown): StudioDocument {
  if (!input || typeof input !== 'object') {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Studio document must be an object');
  }
  const doc = input as Record<string, unknown>;
  if (doc.version !== 1) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Studio document version must be 1', [
      { version: doc.version },
    ]);
  }
  if (!Array.isArray(doc.blocks)) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Studio document requires blocks[]');
  }
  if (doc.blocks.length > 50) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Studio document exceeds 50 blocks');
  }

  const seen = new Set<string>();
  const blocks: StudioBlock[] = [];
  for (const raw of doc.blocks) {
    if (!raw || typeof raw !== 'object') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid studio block');
    }
    const b = raw as Record<string, unknown>;
    const id = typeof b.id === 'string' ? b.id : '';
    const type = typeof b.type === 'string' ? b.type : '';
    if (!BLOCK_ID_RE.test(id)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid studio block id', [{ id }]);
    }
    if (seen.has(id)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Duplicate studio block id', [{ id }]);
    }
    seen.add(id);
    if (!(STUDIO_BLOCK_TYPES as readonly string[]).includes(type)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Unknown studio block type', [{ type }]);
    }
    const props =
      b.props && typeof b.props === 'object' && !Array.isArray(b.props)
        ? (b.props as Record<string, unknown>)
        : {};
    blocks.push({ id, type: type as StudioBlockType, props });
  }

  return { version: 1, blocks };
}

export function emptyStudioDocument(): StudioDocument {
  return { version: 1, blocks: [] };
}

/** Content body stores studio under `studio`; landing layout stores under root or `studio`. */
export function extractStudioDocument(
  container: Record<string, unknown> | null | undefined,
): StudioDocument | null {
  if (!container) return null;
  const candidate =
    container.studio && typeof container.studio === 'object'
      ? container.studio
      : container.version === 1 && Array.isArray(container.blocks)
        ? container
        : null;
  if (!candidate) return null;
  try {
    return assertValidStudioDocument(candidate);
  } catch {
    return null;
  }
}
