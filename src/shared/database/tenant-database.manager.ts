import { Injectable, Inject, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import { SECRET_PROVIDER_PORT } from '../../core/domain/ports/secret-provider.port.js';
import type { SecretProviderPort } from '../../core/domain/ports/secret-provider.port.js';
import { TENANT_REGISTRY_PORT } from '../../modules/identity/domain/ports/tenant-registry.port.js';
import type { TenantRegistryPort } from '../../modules/identity/domain/ports/tenant-registry.port.js';
import { CircuitBreaker } from '../security/resilience.js';
import { MetricsService } from '../observability/metrics.service.js';
import { TracingService } from '../observability/tracing.service.js';
import { DomainError, ErrorCode } from '../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from './control-plane-database.service.js';
import { TENANT_DATABASE_CREDENTIALS_REF } from './database.constants.js';
import { TenantStatus } from '../../modules/identity/domain/tenant/tenant.entity.js';

interface PoolEntry {
  pool: Pool;
  lastUsed: number;
  breaker: CircuitBreaker;
}

@Injectable()
export class TenantDatabaseManager implements OnModuleDestroy {
  private readonly pools = new Map<string, PoolEntry>();
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    @Inject(SECRET_PROVIDER_PORT) private readonly secretProvider: SecretProviderPort,
    @Inject(TENANT_REGISTRY_PORT) private readonly tenantRegistry: TenantRegistryPort,
    private readonly controlPlaneDatabase: ControlPlaneDatabaseService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly tracing?: TracingService,
  ) {
    this.evictionTimer = setInterval(() => this.evictIdlePools(), this.config.DB_POOL_EVICTION_MS);
  }

  getControlPlanePool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async getPool(tenantId: string): Promise<Pool> {
    const resolve = () => this.resolvePool(tenantId);
    if (this.tracing) {
      return this.tracing.runInSpan('db.getPool', () => resolve());
    }
    return resolve();
  }

  private async resolvePool(tenantId: string): Promise<Pool> {
    const existing = this.pools.get(tenantId);
    if (existing) {
      existing.lastUsed = Date.now();
      this.metrics?.databasePoolUsage.inc({ tenant_id: tenantId });
      return existing.breaker.execute(async () => {
        await existing.pool.query('SELECT 1');
        return existing.pool;
      });
    }

    if (this.pools.size >= this.config.DB_POOL_MAX_TENANTS) {
      await this.evictOldestPool();
    }

    const tenant = await this.tenantRegistry.findById(tenantId);
    if (!tenant) {
      throw new DomainError(ErrorCode.TENANT_NOT_FOUND, `Tenant not found: ${tenantId}`);
    }

    // During PROVISIONING (or before a dedicated role exists), connect as cluster admin.
    // Admin password is always the shared TENANT_DB_PASSWORD env ref — never the per-tenant secret.
    const useClusterAdmin =
      tenant.status === TenantStatus.PROVISIONING || !tenant.database.username;
    const user = useClusterAdmin
      ? this.config.CONTROL_PLANE_DB_USER
      : (tenant.database.username as string);
    const password = await this.secretProvider.resolve(
      useClusterAdmin
        ? TENANT_DATABASE_CREDENTIALS_REF
        : (tenant.database.credentialsReference || TENANT_DATABASE_CREDENTIALS_REF),
    );
    const ssl = this.buildSslConfig();

    const poolConfig: PoolConfig = {
      host: tenant.database.host,
      port: tenant.database.port,
      database: tenant.database.name,
      user,
      password,
      max: this.config.DB_POOL_MAX,
      idleTimeoutMillis: this.config.DB_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: this.config.DB_POOL_CONNECTION_TIMEOUT_MS,
      statement_timeout: this.config.DB_STATEMENT_TIMEOUT_MS,
      ssl,
    };

    const pool = new Pool(poolConfig);
    const breaker = new CircuitBreaker(
      this.config.CIRCUIT_BREAKER_THRESHOLD,
      this.config.CIRCUIT_BREAKER_RESET_MS,
    );
    await breaker.execute(async () => {
      await pool.query('SELECT 1');
    });

    const entry: PoolEntry = { pool, lastUsed: Date.now(), breaker };
    this.pools.set(tenantId, entry);
    this.metrics?.databasePoolUsage.inc({ tenant_id: tenantId });
    return pool;
  }

  async getClient(tenantId: string): Promise<PoolClient> {
    const pool = await this.getPool(tenantId);
    return pool.connect();
  }

  async evictPool(tenantId: string): Promise<void> {
    const entry = this.pools.get(tenantId);
    if (!entry) return;
    await entry.pool.end();
    this.pools.delete(tenantId);
  }

  async healthCheck(): Promise<{ controlPlane: boolean; tenantPools: number }> {
    const controlPlane = await this.controlPlaneDatabase.healthCheck();
    return { controlPlane, tenantPools: this.pools.size };
  }

  getCircuitBreakerState(tenantId: string): string {
    return this.pools.get(tenantId)?.breaker.getState() ?? 'unknown';
  }

  private buildSslConfig(): PoolConfig['ssl'] {
    if (!this.config.CONTROL_PLANE_DB_SSL) return undefined;
    return { rejectUnauthorized: this.config.CONTROL_PLANE_DB_SSL_REJECT_UNAUTHORIZED };
  }

  private async evictOldestPool(): Promise<void> {
    let oldestTenantId: string | null = null;
    let oldestUsed = Infinity;
    for (const [tenantId, entry] of this.pools) {
      if (entry.lastUsed < oldestUsed) {
        oldestUsed = entry.lastUsed;
        oldestTenantId = tenantId;
      }
    }
    if (!oldestTenantId) return;
    const entry = this.pools.get(oldestTenantId);
    if (entry) {
      await entry.pool.end();
      this.pools.delete(oldestTenantId);
    }
  }

  private async evictIdlePools(): Promise<void> {
    const now = Date.now();
    for (const [tenantId, entry] of this.pools) {
      if (now - entry.lastUsed > this.config.DB_POOL_EVICTION_MS) {
        await entry.pool.end();
        this.pools.delete(tenantId);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
    }
    for (const [, entry] of this.pools) {
      await entry.pool.end();
    }
    this.pools.clear();
  }
}
