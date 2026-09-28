export type UserLoginHistoryEntry = {
  readonly id: string;
  readonly userId: string;
  readonly eventType: string;
  readonly success: boolean;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly browser: string | null;
  readonly os: string | null;
  readonly device: string | null;
  readonly sessionId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
};

export type RecordLoginHistoryParams = {
  userId: string;
  eventType?: string;
  success?: boolean;
  ip?: string | null;
  userAgent?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
};

export interface UserLoginHistoryRepositoryPort {
  listByUser(
    tenantId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: readonly UserLoginHistoryEntry[]; total: number }>;

  /** Inserts a login event; returns existing row if session+login already recorded. */
  record(
    tenantId: string,
    params: RecordLoginHistoryParams,
  ): Promise<{ entry: UserLoginHistoryEntry; created: boolean }>;
}

export const USER_LOGIN_HISTORY_REPOSITORY_PORT = Symbol(
  'USER_LOGIN_HISTORY_REPOSITORY_PORT',
);
