export interface PaginationParams {
  readonly page?: number;
  readonly limit?: number;
  readonly cursor?: string;
}

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

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function normalizePagination(params: PaginationParams): { page: number; limit: number; offset: number } {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
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
