import type { DatabaseEngine } from './infrastructure.types.js';

export const DATABASE_ENGINE_ADAPTER_REGISTRY_PORT = Symbol(
  'DATABASE_ENGINE_ADAPTER_REGISTRY_PORT',
);

export type CreateDatabaseInput = {
  tenantId: string;
  productId: string;
  databaseName: string;
  adminConnectionRef: string;
  tlsRequired: boolean;
};

export type CreateDatabaseResult = {
  databaseName: string;
  endpointRef: string;
  engineVersion: string | null;
  clusterId: string | null;
  evidence: Record<string, unknown>;
};

export type CreateAppCredentialInput = {
  tenantId: string;
  databaseName: string;
  adminConnectionRef: string;
  username: string;
  password: string;
  tlsRequired: boolean;
};

export type CreateAppCredentialResult = {
  username: string;
  endpointRef: string;
  privileges: string[];
  evidence: Record<string, unknown>;
};

export type VerifyConnectivityInput = {
  endpointRef: string;
  username: string;
  password: string;
  databaseName: string;
  tlsRequired: boolean;
};

export type VerifyIsolationInput = {
  endpointRef: string;
  username: string;
  password: string;
  ownDatabaseName: string;
  foreignDatabaseName: string;
  tlsRequired: boolean;
};

export type BackupDatabaseInput = {
  adminConnectionRef: string;
  databaseName: string;
  backupLabel: string;
};

export type BackupDatabaseResult = {
  providerBackupId: string;
  sizeBytes: number | null;
  evidence: Record<string, unknown>;
  integrityVerified: boolean;
  restorableVerified: boolean;
};

export type RestoreDatabaseInput = {
  adminConnectionRef: string;
  providerBackupId: string;
  targetDatabaseName: string;
};

export type DeprovisionDatabaseInput = {
  adminConnectionRef: string;
  databaseName: string;
  username: string;
};

export interface DatabaseEngineAdapter {
  readonly engine: DatabaseEngine;
  createDatabase(input: CreateDatabaseInput): Promise<CreateDatabaseResult>;
  createAppCredential(input: CreateAppCredentialInput): Promise<CreateAppCredentialResult>;
  verifyConnectivity(input: VerifyConnectivityInput): Promise<{ ok: boolean; evidence: Record<string, unknown> }>;
  verifyIsolation(input: VerifyIsolationInput): Promise<{ isolated: boolean; evidence: Record<string, unknown> }>;
  verifyLeastPrivilege(input: {
    endpointRef: string;
    username: string;
    password: string;
    databaseName: string;
  }): Promise<{ leastPrivilege: boolean; evidence: Record<string, unknown> }>;
  createBackup(input: BackupDatabaseInput): Promise<BackupDatabaseResult>;
  restoreBackup(input: RestoreDatabaseInput): Promise<{ evidence: Record<string, unknown> }>;
  rotateCredential(input: CreateAppCredentialInput & { previousUsername: string }): Promise<CreateAppCredentialResult>;
  deprovision(input: DeprovisionDatabaseInput): Promise<{ evidence: Record<string, unknown> }>;
}

export interface DatabaseEngineAdapterRegistryPort {
  get(engine: DatabaseEngine): DatabaseEngineAdapter | null;
  listEngines(): DatabaseEngine[];
}
