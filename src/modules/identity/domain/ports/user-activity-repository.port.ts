export type UserActivityEvent = {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string | null;
  readonly category: string;
  readonly title: string;
  readonly detail: string;
  readonly href: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
};

export type CreateUserActivityParams = {
  userId: string;
  organizationId?: string | null;
  category?: string;
  title: string;
  detail?: string;
  href?: string | null;
  payload?: Record<string, unknown>;
};

export interface UserActivityRepositoryPort {
  listByUser(
    tenantId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: readonly UserActivityEvent[]; total: number }>;

  create(
    tenantId: string,
    params: CreateUserActivityParams,
  ): Promise<UserActivityEvent>;

  clearByUser(tenantId: string, userId: string): Promise<number>;
}

export const USER_ACTIVITY_REPOSITORY_PORT = Symbol('USER_ACTIVITY_REPOSITORY_PORT');
