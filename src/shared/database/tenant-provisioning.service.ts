import { Injectable, Inject } from '@nestjs/common';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import pg, { type Pool } from 'pg';
import type {
  TenantDatabaseMigratorPort,
  TenantDatabaseProvisionerPort,
  TenantProvisioningRequest,
  TenantProvisioningResult,
  TenantDatabaseHealthCheckerPort,
  TenantDeprovisionOptions,
} from '../../core/domain/ports/tenant-provisioning.port.js';
import { TENANT_REGISTRY_PORT } from '../../modules/identity/domain/ports/tenant-registry.port.js';
import type { TenantRegistryPort } from '../../modules/identity/domain/ports/tenant-registry.port.js';
import { TENANT_DATABASE_MIGRATOR_PORT } from '../../core/domain/ports/tenant-provisioning.port.js';
import { SECRET_PROVIDER_PORT } from '../../core/domain/ports/secret-provider.port.js';
import type { SecretProviderPort } from '../../core/domain/ports/secret-provider.port.js';
import { TenantDatabaseManager } from '../database/tenant-database.manager.js';
import { TENANT_DATABASE_CREDENTIALS_REF } from './database.constants.js';
import { withRetry } from '../security/resilience.js';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import { DomainError, ErrorCode } from '../../core/domain/errors/domain-error.js';
import { TenantProvisioningStep, TenantStatus } from '../../modules/identity/domain/tenant/tenant.entity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function quoteDatabaseIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid database identifier: ${name}`);
  }
  return `"${name.replace(/"/g, '""')}"`;
}

/** Stable LOGIN role name for a tenant slug (shared-cluster, DB-per-tenant). */
export function tenantDatabaseRoleName(slug: string): string {
  const base = `t_${slug.replace(/[^a-z0-9_]/g, '_')}`.slice(0, 50);
  return `${base}_app`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

@Injectable()
export class PgTenantDatabaseProvisioner implements TenantDatabaseProvisionerPort {
  constructor(
    private readonly dbManager: TenantDatabaseManager,
    @Inject(SECRET_PROVIDER_PORT) private readonly secretProvider: SecretProviderPort,
    @Inject(TENANT_DATABASE_MIGRATOR_PORT) private readonly migrator: TenantDatabaseMigratorPort,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
  ) {}

  async registerTenant(
    request: TenantProvisioningRequest,
  ): Promise<{ tenantId: string; created: boolean }> {
    const pool = this.dbManager.getControlPlanePool();

    // Idempotency: if key provided, look for existing row
    if (request.provisionIdempotencyKey) {
      const existing = await pool.query<{ id: string }>(
        `SELECT id FROM tenants WHERE provision_idempotency_key = $1`,
        [request.provisionIdempotencyKey],
      );
      if (existing.rows[0]) {
        return { tenantId: existing.rows[0].id, created: false };
      }
    }

    // Slug uniqueness check
    const slugCheck = await pool.query<{ id: string }>(
      `SELECT id FROM tenants WHERE slug = $1 AND status != 'DELETED'`,
      [request.slug],
    );
    if (slugCheck.rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, `Tenant slug '${request.slug}' already exists`, [
        { slug: request.slug },
      ]);
    }

    const databaseUsername = tenantDatabaseRoleName(request.slug);

    const insertValues: unknown[] = [
      request.slug,
      request.databaseHost,
      request.databasePort,
      request.databaseName,
      databaseUsername,
      request.credentialsReference,
      request.region,
      request.environment,
      TenantProvisioningStep.REQUESTED,
      request.provisionIdempotencyKey ?? null,
    ];

    let insertSql: string;
    if (request.tenantId) {
      insertSql = `INSERT INTO tenants (id, slug, status, database_host, database_port, database_name,
          database_username, database_credentials_ref, region, environment,
          provisioning_step, provision_idempotency_key)
         VALUES ($11, $1, 'PROVISIONING', $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`;
      insertValues.push(request.tenantId);
    } else {
      insertSql = `INSERT INTO tenants (slug, status, database_host, database_port, database_name,
          database_username, database_credentials_ref, region, environment,
          provisioning_step, provision_idempotency_key)
         VALUES ($1, 'PROVISIONING', $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`;
    }

    const result = await pool.query<{ id: string }>(insertSql, insertValues);
    return { tenantId: result.rows[0].id, created: true };
  }

  async createDatabaseInfrastructure(
    tenantId: string,
  ): Promise<{ databaseName: string; databaseUsername: string }> {
    const pool = this.dbManager.getControlPlanePool();
    const tenantRow = await pool.query<{
      database_host: string;
      database_port: number;
      database_name: string;
      slug: string;
      database_credentials_ref: string;
    }>(
      `SELECT database_host, database_port, database_name, slug, database_credentials_ref FROM tenants WHERE id = $1`,
      [tenantId],
    );

    const row = tenantRow.rows[0];
    if (!row) throw new DomainError(ErrorCode.TENANT_NOT_FOUND, `Tenant not found: ${tenantId}`);

    const databaseUsername = tenantDatabaseRoleName(row.slug);
    // Cluster admin password (CREATE DATABASE / ROLE) — shared cluster credential
    const adminPassword = await this.secretProvider.resolve(TENANT_DATABASE_CREDENTIALS_REF);
    // Dedicated app-role password — unique per tenant when secret provider supports put
    const tenantPassword = randomBytes(32).toString('base64url');
    const credentialsRef = await this.secretProvider.putTenantDatabasePassword(
      tenantId,
      tenantPassword,
    );
    const adminUser = this.config.CONTROL_PLANE_DB_USER;

    await withRetry(async () => {
      const adminPool = new pg.Pool({
        host: row.database_host,
        port: row.database_port,
        database: 'postgres',
        user: adminUser,
        password: adminPassword,
      });
      try {
        const dbName = quoteDatabaseIdentifier(row.database_name);
        const roleName = quoteDatabaseIdentifier(databaseUsername);

        const exists = await adminPool.query<{ exists: boolean }>(
          `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists`,
          [row.database_name],
        );
        if (!exists.rows[0]?.exists) {
          await adminPool.query(`CREATE DATABASE ${dbName}`);
        }

        try {
          await adminPool.query(
            `CREATE ROLE ${roleName} WITH LOGIN PASSWORD ${quoteLiteral(tenantPassword)}`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!/already exists/i.test(message)) throw error;
          await adminPool.query(
            `ALTER ROLE ${roleName} WITH LOGIN PASSWORD ${quoteLiteral(tenantPassword)}`,
          );
        }

        await adminPool.query(`REVOKE ALL ON DATABASE ${dbName} FROM PUBLIC`);
        await adminPool.query(`GRANT CONNECT ON DATABASE ${dbName} TO ${roleName}`);
        await adminPool.query(
          `GRANT CONNECT ON DATABASE ${dbName} TO ${quoteDatabaseIdentifier(adminUser)}`,
        );
      } finally {
        await adminPool.end();
      }
    });

    await pool.query(
      `UPDATE tenants
       SET database_username = $2,
           database_credentials_ref = $3,
           provisioning_step = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [tenantId, databaseUsername, credentialsRef, TenantProvisioningStep.DB_CREATED],
    );

    return { databaseName: row.database_name, databaseUsername };
  }

  async migrateAndGrant(tenantId: string): Promise<void> {
    const pool = this.dbManager.getControlPlanePool();
    const tenantRow = await pool.query<{
      database_host: string;
      database_port: number;
      database_name: string;
      database_username: string | null;
    }>(
      `SELECT database_host, database_port, database_name, database_username
       FROM tenants WHERE id = $1`,
      [tenantId],
    );
    const row = tenantRow.rows[0];
    if (!row) throw new DomainError(ErrorCode.TENANT_NOT_FOUND, `Tenant not found: ${tenantId}`);

    await this.migrator.migrate(tenantId);

    // Grants run as cluster admin (shared control-plane DB password), not the tenant app role.
    const adminPassword = await this.secretProvider.resolve(TENANT_DATABASE_CREDENTIALS_REF);
    if (row.database_username) {
      await this.grantSchemaPrivileges(
        row.database_host,
        row.database_port,
        row.database_name,
        row.database_username,
        adminPassword,
      );
    }

    await this.dbManager.evictPool(tenantId);

    await pool.query(
      `UPDATE tenants SET provisioning_step = $2, updated_at = NOW() WHERE id = $1`,
      [tenantId, TenantProvisioningStep.MIGRATED],
    );
  }

  async provision(request: TenantProvisioningRequest): Promise<TenantProvisioningResult> {
    const { tenantId } = await this.registerTenant(request);
    const { databaseName, databaseUsername } = await this.createDatabaseInfrastructure(tenantId);
    await this.migrateAndGrant(tenantId);

    const pool = this.dbManager.getControlPlanePool();
    await pool.query(
      `UPDATE tenants SET status = $2, provisioning_step = $3, updated_at = NOW() WHERE id = $1`,
      [tenantId, TenantStatus.ACTIVE, TenantProvisioningStep.READY],
    );

    return {
      tenantId,
      databaseName,
      databaseUsername,
      status: 'ACTIVE',
    };
  }

  private async grantSchemaPrivileges(
    host: string,
    port: number,
    databaseName: string,
    databaseUsername: string,
    password: string,
  ): Promise<void> {
    const tenantPool = new pg.Pool({
      host,
      port,
      database: databaseName,
      user: this.config.CONTROL_PLANE_DB_USER,
      password,
    });
    try {
      const roleName = quoteDatabaseIdentifier(databaseUsername);
      await tenantPool.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${roleName}`);
      await tenantPool.query(
        `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${roleName}`,
      );
      await tenantPool.query(
        `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${roleName}`,
      );
      await tenantPool.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${roleName}`,
      );
      await tenantPool.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${roleName}`,
      );
    } finally {
      await tenantPool.end();
    }
  }

  async deprovision(tenantId: string, options?: TenantDeprovisionOptions): Promise<void> {
    const pool = this.dbManager.getControlPlanePool();
    const hard = options?.hard === true;

    const tenant = await pool.query<{
      database_host: string;
      database_port: number;
      database_name: string;
      database_username: string | null;
      database_credentials_ref: string;
      status: string;
    }>(
      `SELECT database_host, database_port, database_name, database_username,
              database_credentials_ref, status
       FROM tenants WHERE id = $1`,
      [tenantId],
    );
    const row = tenant.rows[0];
    if (!row) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    await pool.query(`UPDATE tenants SET status = 'DEACTIVATING', updated_at = NOW() WHERE id = $1`, [
      tenantId,
    ]);

    await this.dbManager.evictPool(tenantId);

    if (hard) {
      const password = await this.secretProvider.resolve(TENANT_DATABASE_CREDENTIALS_REF);
      const adminPool = new pg.Pool({
        host: row.database_host,
        port: row.database_port,
        database: 'postgres',
        user: this.config.CONTROL_PLANE_DB_USER,
        password,
      });
      try {
        const dbName = quoteDatabaseIdentifier(row.database_name);
        await adminPool.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [row.database_name],
        );
        await adminPool.query(`DROP DATABASE IF EXISTS ${dbName}`);
        if (row.database_username) {
          await adminPool.query(
            `DROP ROLE IF EXISTS ${quoteDatabaseIdentifier(row.database_username)}`,
          );
        }
      } finally {
        await adminPool.end();
      }

      try {
        await this.secretProvider.deleteTenantDatabasePassword(row.database_credentials_ref);
      } catch {
        // Best-effort secret revocation; DB/role already dropped
      }
    }

    await pool.query(
      `UPDATE tenants
       SET status = 'DELETED',
           database_credentials_ref = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [tenantId, TENANT_DATABASE_CREDENTIALS_REF],
    );  }
}

@Injectable()
export class PgTenantDatabaseMigrator implements TenantDatabaseMigratorPort {
  constructor(
    private readonly dbManager: TenantDatabaseManager,
    @Inject(TENANT_REGISTRY_PORT) private readonly tenantRegistry: TenantRegistryPort,
  ) {}

  async migrate(tenantId: string): Promise<void> {
    const tenant = await this.tenantRegistry.findById(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

    // During PROVISIONING, registry may exclude or still find the row — use manager which loads by id.
    // Tenant registry filters DELETED only; PROVISIONING is findable.
    const pool = await this.dbManager.getPool(tenantId);
    const migrationsDir = join(__dirname, '..', '..', '..', 'migrations', 'tenant');
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      for (const file of files) {
        const version = file.replace('.sql', '');
        const applied = await client.query(
          'SELECT 1 FROM schema_migrations WHERE version = $1',
          [version],
        );
        if (applied.rowCount) continue;

        const sql = readFileSync(join(migrationsDir, file), 'utf-8');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
          [version],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async migrateAll(): Promise<void> {
    const pool = this.dbManager.getControlPlanePool();
    const lockOwner = process.env.HOSTNAME ?? 'platform-core';
    const lock = await pool.query(
      `UPDATE migration_lock
       SET locked_at = NOW(), locked_by = $1
       WHERE id = 1
         AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '10 minutes')
       RETURNING id`,
      [lockOwner],
    );
    if (!lock.rows[0]) return;

    try {
      const result = await pool.query<{ id: string }>(
        `SELECT id FROM tenants WHERE status IN ('ACTIVE', 'READ_ONLY')`,
      );
      for (const row of result.rows) {
        await this.migrate(row.id);
      }
    } finally {
      await pool.query(
        `UPDATE migration_lock SET locked_at = NULL, locked_by = NULL WHERE id = 1 AND locked_by = $1`,
        [lockOwner],
      );
    }
  }
}

@Injectable()
export class PgTenantDatabaseHealthChecker implements TenantDatabaseHealthCheckerPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async check(tenantId: string): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const pool = await this.dbManager.getPool(tenantId);
      await pool.query('SELECT 1');
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }
}
