import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  NumberPreview,
  TenantSettingsResourcesPort,
} from '../../domain/ports/tenant-settings-resources.port.js';

const ALLOWED_TABLES = new Set([
  'tenant_currencies',
  'tenant_fx_rates',
  'tenant_fiscal_years',
  'tenant_fiscal_periods',
  'tenant_tax_categories',
  'tenant_tax_jurisdictions',
  'tenant_tax_rates',
  'tenant_tax_rules',
  'tenant_tax_exemptions',
  'tenant_number_sequences',
  'tenant_document_templates',
  'tenant_integrations',
  'tenant_api_keys',
  'tenant_webhooks',
  'tenant_oauth_apps',
  'tenant_service_accounts',
  'tenant_billing_subscriptions',
  'tenant_billing_invoices',
  'tenant_data_jobs',
]);

const WRITE_COLUMNS: Record<string, readonly string[]> = {
  tenant_currencies: ['code', 'name', 'decimals', 'is_primary', 'is_secondary', 'is_active'],
  tenant_fx_rates: ['from_code', 'to_code', 'rate', 'source', 'effective_at'],
  tenant_fiscal_years: ['label', 'starts_on', 'ends_on', 'status'],
  tenant_fiscal_periods: [
    'fiscal_year_id',
    'label',
    'period_index',
    'starts_on',
    'ends_on',
    'status',
  ],
  tenant_tax_categories: ['code', 'name', 'description', 'is_active'],
  tenant_tax_jurisdictions: ['code', 'name', 'country', 'region', 'is_active'],
  tenant_tax_rates: [
    'code',
    'name',
    'rate_percent',
    'category_id',
    'jurisdiction_id',
    'kind',
    'is_compound',
    'is_default',
    'is_active',
  ],
  tenant_tax_rules: [
    'name',
    'priority',
    'jurisdiction_id',
    'category_id',
    'tax_rate_id',
    'conditions',
    'is_active',
  ],
  tenant_tax_exemptions: [
    'code',
    'name',
    'reason',
    'certificate_ref',
    'valid_from',
    'valid_to',
    'is_active',
  ],
  tenant_number_sequences: [
    'document_type',
    'prefix',
    'suffix',
    'next_value',
    'pad_length',
    'reset_policy',
    'scope',
    'organization_id',
    'manual_allowed',
    'unique_check',
  ],
  tenant_document_templates: [
    'document_type',
    'language',
    'name',
    'body_html',
    'footer',
    'legal_mentions',
    'terms',
    'logo_override_url',
    'watermark',
    'is_default',
  ],
  tenant_integrations: [
    'provider',
    'category',
    'display_name',
    'status',
    'health',
    'last_sync_at',
    'sync_frequency',
    'credentials_ref',
    'config',
    'permissions',
    'last_error',
  ],
  tenant_api_keys: ['name', 'key_prefix', 'key_hash', 'scopes', 'rate_limit', 'expires_at'],
  tenant_webhooks: [
    'url',
    'events',
    'secret_ref',
    'status',
    'allowed_origins',
    'last_delivery_at',
    'last_status_code',
  ],
  tenant_oauth_apps: ['name', 'client_id', 'client_secret_ref', 'redirect_uris', 'scopes', 'status'],
  tenant_service_accounts: ['name', 'description', 'scopes', 'status'],
  tenant_billing_subscriptions: ['plan_code', 'status', 'renew_at', 'seats', 'metadata'],
  tenant_billing_invoices: [
    'invoice_number',
    'amount',
    'currency',
    'status',
    'period_start',
    'period_end',
    'pdf_ref',
    'issued_at',
  ],
  tenant_data_jobs: [
    'job_type',
    'status',
    'progress',
    'result_ref',
    'error_message',
    'metadata',
  ],
};

function toCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}

function toSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

@Injectable()
export class PgTenantSettingsResourcesRepository implements TenantSettingsResourcesPort {
  constructor(
    private readonly dbManager: TenantDatabaseManager,
    private readonly controlPlane: ControlPlaneDatabaseService,
  ) {}

  private assertTable(table: string): void {
    if (!ALLOWED_TABLES.has(table)) {
      throw new Error(`Table not allowed: ${table}`);
    }
  }

  async list(tenantId: string, table: string): Promise<Record<string, unknown>[]> {
    this.assertTable(table);
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC NULLS LAST`);
    return result.rows.map((r) => toCamel(r as Record<string, unknown>));
  }

  async getById(
    tenantId: string,
    table: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    this.assertTable(table);
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return result.rows[0] ? toCamel(result.rows[0] as Record<string, unknown>) : null;
  }

  async insert(
    tenantId: string,
    table: string,
    row: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.assertTable(table);
    const pool = await this.dbManager.getPool(tenantId);
    const cols = WRITE_COLUMNS[table] ?? [];
    const payload = { ...row };

    if (table === 'tenant_api_keys' && !payload.key_hash && !payload.keyHash) {
      const raw = `pk_${randomBytes(24).toString('hex')}`;
      payload.keyPrefix = raw.slice(0, 10);
      payload.key_prefix = payload.keyPrefix;
      payload.keyHash = createHash('sha256').update(raw).digest('hex');
      payload.key_hash = payload.keyHash;
      (payload as { plaintextKey?: string }).plaintextKey = raw;
    }

    if (table === 'tenant_oauth_apps' && !payload.client_id && !payload.clientId) {
      payload.clientId = `oa_${randomBytes(12).toString('hex')}`;
      payload.client_id = payload.clientId;
    }

    const snakePayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (k === 'plaintextKey' || k === 'id') continue;
      snakePayload[toSnakeKey(k)] = v;
    }

    const keys = cols.filter((c) => snakePayload[c] !== undefined);
    const values = keys.map((c) => {
      const v = snakePayload[c];
      return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
    });
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const result = await pool.query(
      `INSERT INTO ${table} (${keys.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values,
    );
    const mapped = toCamel(result.rows[0] as Record<string, unknown>);
    if ((payload as { plaintextKey?: string }).plaintextKey) {
      mapped.plaintextKey = (payload as { plaintextKey?: string }).plaintextKey;
    }
    return mapped;
  }

  async update(
    tenantId: string,
    table: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    this.assertTable(table);
    const pool = await this.dbManager.getPool(tenantId);
    const cols = WRITE_COLUMNS[table] ?? [];
    const fields: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;
    for (const [k, v] of Object.entries(patch)) {
      const col = toSnakeKey(k);
      if (!cols.includes(col)) continue;
      fields.push(`${col} = $${idx++}`);
      values.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
    }
    if (fields.length === 0) return this.getById(tenantId, table, id);
    if (cols.includes('updated_at') || true) {
      // most tables have updated_at; ignore if missing via try
      fields.push('updated_at = NOW()');
    }
    try {
      const result = await pool.query(
        `UPDATE ${table} SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
        values,
      );
      return result.rows[0] ? toCamel(result.rows[0] as Record<string, unknown>) : null;
    } catch {
      const withoutUpdated = fields.filter((f) => !f.startsWith('updated_at'));
      const result = await pool.query(
        `UPDATE ${table} SET ${withoutUpdated.join(', ')} WHERE id = $1 RETURNING *`,
        values,
      );
      return result.rows[0] ? toCamel(result.rows[0] as Record<string, unknown>) : null;
    }
  }

  async remove(tenantId: string, table: string, id: string): Promise<boolean> {
    this.assertTable(table);
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async previewNumber(tenantId: string, sequenceId: string): Promise<NumberPreview | null> {
    const seq = await this.getById(tenantId, 'tenant_number_sequences', sequenceId);
    if (!seq) return null;
    return this.formatNumber(seq);
  }

  async nextNumber(tenantId: string, sequenceId: string): Promise<NumberPreview | null> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query(
      `UPDATE tenant_number_sequences
       SET next_value = next_value + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [sequenceId],
    );
    if (!result.rows[0]) return null;
    const seq = toCamel(result.rows[0] as Record<string, unknown>);
    // return the value just consumed
    const used = { ...seq, nextValue: Number(seq.nextValue) - 1 };
    return this.formatNumber(used);
  }

  private formatNumber(seq: Record<string, unknown>): NumberPreview {
    const nextValue = Number(seq.nextValue ?? 1);
    const pad = Number(seq.padLength ?? 6);
    const year = new Date().getFullYear();
    const prefix = String(seq.prefix ?? '');
    const suffix = String(seq.suffix ?? '');
    const reset = String(seq.resetPolicy ?? 'NEVER');
    const mid =
      reset === 'YEAR'
        ? `${year}-${String(nextValue).padStart(pad, '0')}`
        : reset === 'MONTH'
          ? `${year}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(nextValue).padStart(pad, '0')}`
          : String(nextValue).padStart(pad, '0');
    return { preview: `${prefix}${mid}${suffix}`, nextValue };
  }

  async listAuditLogs(
    tenantId: string,
    opts: {
      page: number;
      limit: number;
      action?: string;
      resource?: string;
      from?: string;
      to?: string;
    },
  ): Promise<{ items: Record<string, unknown>[]; total: number }> {
    const pool = this.controlPlane.getPool();
    const where: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let idx = 2;
    if (opts.action) {
      where.push(`action = $${idx++}`);
      params.push(opts.action);
    }
    if (opts.resource) {
      where.push(`resource = $${idx++}`);
      params.push(opts.resource);
    }
    if (opts.from) {
      where.push(`timestamp >= $${idx++}`);
      params.push(opts.from);
    }
    if (opts.to) {
      where.push(`timestamp <= $${idx++}`);
      params.push(opts.to);
    }
    const whereSql = where.join(' AND ');
    const count = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_logs WHERE ${whereSql}`,
      params,
    );
    const offset = (opts.page - 1) * opts.limit;
    params.push(opts.limit, offset);
    const rows = await pool.query(
      `SELECT id, tenant_id, organization_id, actor_id, actor_type, action, resource,
              resource_id, status, timestamp, correlation_id, request_id, ip, user_agent,
              before_state, after_state, metadata
       FROM audit_logs
       WHERE ${whereSql}
       ORDER BY timestamp DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );
    return {
      total: Number(count.rows[0]?.count ?? 0),
      items: rows.rows.map((r) => toCamel(r as Record<string, unknown>)),
    };
  }
}
