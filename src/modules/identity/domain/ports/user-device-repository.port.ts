export type UserDevice = {
  readonly id: string;
  readonly userId: string;
  readonly externalSessionId: string | null;
  readonly deviceName: string | null;
  readonly platform: string | null;
  readonly browser: string | null;
  readonly os: string | null;
  readonly lastIp: string | null;
  readonly lastSeenAt: Date;
  readonly trusted: boolean;
  readonly pushToken: string | null;
  readonly pushPlatform: string | null;
  readonly pushEnrolledAt: Date | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type UpsertUserDeviceParams = {
  userId: string;
  externalSessionId?: string | null;
  deviceName?: string | null;
  platform?: string | null;
  browser?: string | null;
  os?: string | null;
  lastIp?: string | null;
  lastSeenAt?: Date;
  trusted?: boolean;
  pushToken?: string | null;
  pushPlatform?: string | null;
  metadata?: Record<string, unknown>;
};

export type EnrollPushDeviceParams = {
  userId: string;
  deviceName: string;
  platform?: string | null;
  pushToken: string;
  pushPlatform: string;
  browser?: string | null;
  os?: string | null;
  lastIp?: string | null;
  metadata?: Record<string, unknown>;
};

export interface UserDeviceRepositoryPort {
  listByUser(tenantId: string, userId: string): Promise<readonly UserDevice[]>;

  upsertFromSession(
    tenantId: string,
    params: UpsertUserDeviceParams,
  ): Promise<UserDevice>;

  enrollPush(
    tenantId: string,
    params: EnrollPushDeviceParams,
  ): Promise<UserDevice>;

  clearPush(
    tenantId: string,
    userId: string,
    deviceId: string,
  ): Promise<UserDevice | null>;

  setTrusted(
    tenantId: string,
    userId: string,
    deviceId: string,
    trusted: boolean,
  ): Promise<UserDevice | null>;

  remove(tenantId: string, userId: string, deviceId: string): Promise<boolean>;
}

export const USER_DEVICE_REPOSITORY_PORT = Symbol('USER_DEVICE_REPOSITORY_PORT');
