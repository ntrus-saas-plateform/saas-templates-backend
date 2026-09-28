export type UserApiToken = {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly tokenPrefix: string;
  readonly scopes: readonly string[];
  readonly lastUsedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CreateUserApiTokenParams = {
  userId: string;
  name: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes?: readonly string[];
  expiresAt?: Date | null;
};

export interface UserApiTokenRepositoryPort {
  listByUser(tenantId: string, userId: string): Promise<readonly UserApiToken[]>;

  create(tenantId: string, params: CreateUserApiTokenParams): Promise<UserApiToken>;

  revoke(
    tenantId: string,
    userId: string,
    tokenId: string,
  ): Promise<UserApiToken | null>;

  findActiveByHash(
    tenantId: string,
    tokenHash: string,
  ): Promise<UserApiToken | null>;

  touchLastUsed(tenantId: string, tokenId: string): Promise<void>;
}

export const USER_API_TOKEN_REPOSITORY_PORT = Symbol('USER_API_TOKEN_REPOSITORY_PORT');
