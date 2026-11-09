import type { PublicationSnapshot } from '../publication/publication.entity.js';

export interface CreatePublicationSnapshotParams {
  productId: string;
  productVersionId: string;
  snapshot: Record<string, unknown>;
  publishedBy?: string | null;
  approvalRefs?: readonly unknown[];
}

export interface PublicationRepositoryPort {
  create(params: CreatePublicationSnapshotParams): Promise<PublicationSnapshot>;
  listByProduct(productId: string): Promise<readonly PublicationSnapshot[]>;
}

export const PUBLICATION_REPOSITORY_PORT = Symbol('PUBLICATION_REPOSITORY_PORT');
