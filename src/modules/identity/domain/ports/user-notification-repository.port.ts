export type UserNotification = {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string | null;
  readonly channel: string;
  readonly category: string;
  readonly priority: string;
  readonly title: string;
  readonly body: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly readAt: Date | null;
  readonly createdAt: Date;
};

export type CreateUserNotificationParams = {
  userId: string;
  organizationId?: string | null;
  channel?: string;
  category?: string;
  priority?: string;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
};

export interface UserNotificationRepositoryPort {
  listByUser(
    tenantId: string,
    userId: string,
    page: number,
    limit: number,
    opts?: { unreadOnly?: boolean },
  ): Promise<{ items: readonly UserNotification[]; total: number; unreadCount: number }>;

  markRead(
    tenantId: string,
    userId: string,
    notificationId: string,
  ): Promise<UserNotification | null>;

  markAllRead(tenantId: string, userId: string): Promise<number>;

  create(
    tenantId: string,
    params: CreateUserNotificationParams,
  ): Promise<UserNotification>;

  delete(
    tenantId: string,
    userId: string,
    notificationId: string,
  ): Promise<boolean>;
}

export const USER_NOTIFICATION_REPOSITORY_PORT = Symbol(
  'USER_NOTIFICATION_REPOSITORY_PORT',
);
