import { Global, Module } from '@nestjs/common';
import { TenantDatabaseManager } from './tenant-database.manager.js';
import { ControlPlaneDatabaseService } from './control-plane-database.service.js';
import { PgTransactionManager } from './pg-transaction.manager.js';
import {
  PgTenantDatabaseProvisioner,
  PgTenantDatabaseMigrator,
  PgTenantDatabaseHealthChecker,
} from './tenant-provisioning.service.js';
import { TRANSACTION_MANAGER_PORT } from '../../core/domain/ports/transaction-manager.port.js';
import {
  TENANT_DATABASE_PROVISIONER_PORT,
  TENANT_DATABASE_MIGRATOR_PORT,
  TENANT_DATABASE_HEALTH_CHECKER_PORT,
} from '../../core/domain/ports/tenant-provisioning.port.js';
import { SECRET_PROVIDER_PORT } from '../../core/domain/ports/secret-provider.port.js';
import { USER_PREFERENCES_PORT } from '../../core/domain/ports/user-preferences.port.js';
import { EnvSecretProvider } from '../configuration/env-secret.provider.js';
import { VaultSecretProvider } from '../configuration/vault-secret.provider.js';
import { PgUserPreferencesRepository } from './pg-user-preferences.repository.js';
import { IdentityPersistenceModule } from '../../modules/identity/infrastructure/persistence/identity-persistence.module.js';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';

@Global()
@Module({
  imports: [IdentityPersistenceModule],
  providers: [
    ControlPlaneDatabaseService,
    TenantDatabaseManager,
    EnvSecretProvider,
    VaultSecretProvider,
    { provide: TRANSACTION_MANAGER_PORT, useClass: PgTransactionManager },
    {
      provide: SECRET_PROVIDER_PORT,
      useFactory: (
        config: EnvironmentConfig,
        envProvider: EnvSecretProvider,
        vaultProvider: VaultSecretProvider,
      ) => (config.SECRET_PROVIDER === 'vault' ? vaultProvider : envProvider),
      inject: [APP_CONFIG, EnvSecretProvider, VaultSecretProvider],
    },
    { provide: TENANT_DATABASE_PROVISIONER_PORT, useClass: PgTenantDatabaseProvisioner },
    { provide: TENANT_DATABASE_MIGRATOR_PORT, useClass: PgTenantDatabaseMigrator },
    { provide: TENANT_DATABASE_HEALTH_CHECKER_PORT, useClass: PgTenantDatabaseHealthChecker },
    { provide: USER_PREFERENCES_PORT, useClass: PgUserPreferencesRepository },
  ],
  exports: [
    ControlPlaneDatabaseService,
    TenantDatabaseManager,
    IdentityPersistenceModule,
    TRANSACTION_MANAGER_PORT,
    SECRET_PROVIDER_PORT,
    TENANT_DATABASE_PROVISIONER_PORT,
    TENANT_DATABASE_MIGRATOR_PORT,
    TENANT_DATABASE_HEALTH_CHECKER_PORT,
    USER_PREFERENCES_PORT,
  ],
})
export class DatabaseModule {}
