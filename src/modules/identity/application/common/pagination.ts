export interface PaginationMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly nextCursor: string | null;
}

export interface PaginatedResult<T> {
  readonly data: readonly T[];
  readonly pagination: PaginationMeta;
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
    nextCursor: null,
  };
}

export function normalizePageLimit(
  page?: number,
  limit?: number,
  maxLimit = 100,
): { page: number; limit: number } {
  const normalizedPage = Math.max(1, page ?? 1);
  const normalizedLimit = Math.min(maxLimit, Math.max(1, limit ?? 20));
  return { page: normalizedPage, limit: normalizedLimit };
}
