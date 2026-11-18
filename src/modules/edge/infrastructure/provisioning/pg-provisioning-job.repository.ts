import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  ProvisioningJob,
  ProvisioningJobPort,
  ProvisioningJobType,
} from '../../domain/provisioning/provisioning-job.port.js';

@Injectable()
export class PgProvisioningJobRepository implements ProvisioningJobPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async enqueue(input: {
    subscriptionId: string;
    jobType: ProvisioningJobType;
    payload?: Record<string, unknown>;
    correlationId?: string | null;
    idempotencyKey?: string | null;
    nextAttemptAt?: Date;
  }): Promise<ProvisioningJob> {
    if (input.idempotencyKey) {
      const existing = await this.pool.query(
        `SELECT * FROM edge_provisioning_jobs WHERE idempotency_key = $1 LIMIT 1`,
        [input.idempotencyKey],
      );
      if (existing.rows[0]) return mapRow(existing.rows[0]);
    }
    const res = await this.pool.query(
      `INSERT INTO edge_provisioning_jobs (
         subscription_id, job_type, payload, correlation_id, idempotency_key, next_attempt_at
       ) VALUES ($1, $2, $3::jsonb, $4, $5, $6)
       RETURNING *`,
      [
        input.subscriptionId,
        input.jobType,
        JSON.stringify(input.payload ?? {}),
        input.correlationId ?? null,
        input.idempotencyKey ?? null,
        input.nextAttemptAt ?? new Date(),
      ],
    );
    return mapRow(res.rows[0]);
  }

  async claimNext(limit = 10): Promise<ProvisioningJob[]> {
    const res = await this.pool.query(
      `WITH cte AS (
         SELECT id FROM edge_provisioning_jobs
         WHERE status IN ('PENDING', 'FAILED')
           AND attempt_count < max_attempts
           AND next_attempt_at <= NOW()
         ORDER BY next_attempt_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE edge_provisioning_jobs j
       SET status = 'RUNNING',
           attempt_count = attempt_count + 1,
           updated_at = NOW()
       FROM cte
       WHERE j.id = cte.id
       RETURNING j.*`,
      [limit],
    );
    return res.rows.map(mapRow);
  }

  async markRunning(id: string): Promise<ProvisioningJob> {
    const res = await this.pool.query(
      `UPDATE edge_provisioning_jobs
       SET status = 'RUNNING', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return mapRow(res.rows[0]);
  }

  async markSucceeded(
    id: string,
    checkpoint?: Record<string, unknown>,
  ): Promise<ProvisioningJob> {
    const res = await this.pool.query(
      `UPDATE edge_provisioning_jobs
       SET status = 'SUCCEEDED',
           checkpoint = COALESCE(checkpoint, '{}'::jsonb) || $2::jsonb,
           completed_at = NOW(),
           updated_at = NOW(),
           last_error = NULL
       WHERE id = $1 RETURNING *`,
      [id, JSON.stringify(checkpoint ?? {})],
    );
    return mapRow(res.rows[0]);
  }

  async markFailed(
    id: string,
    error: string,
    opts?: { deadLetter?: boolean; retryDelayMs?: number },
  ): Promise<ProvisioningJob> {
    const delay = opts?.retryDelayMs ?? 30_000;
    const status = opts?.deadLetter ? 'DEAD_LETTER' : 'FAILED';
    const res = await this.pool.query(
      `UPDATE edge_provisioning_jobs
       SET status = $2,
           last_error = $3,
           next_attempt_at = NOW() + ($4 || ' milliseconds')::interval,
           completed_at = CASE WHEN $2 = 'DEAD_LETTER' THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, status, error.slice(0, 2000), String(delay)],
    );
    return mapRow(res.rows[0]);
  }

  async listBySubscription(subscriptionId: string): Promise<ProvisioningJob[]> {
    const res = await this.pool.query(
      `SELECT * FROM edge_provisioning_jobs
       WHERE subscription_id = $1
       ORDER BY created_at DESC`,
      [subscriptionId],
    );
    return res.rows.map(mapRow);
  }

  async getBacklogStats(): Promise<{ pending: number; oldestAgeSeconds: number }> {
    const res = await this.pool.query<{
      pending: number;
      oldest_age_seconds: number | string | null;
    }>(
      `SELECT
         COUNT(*)::int AS pending,
         COALESCE(
           EXTRACT(EPOCH FROM (NOW() - MIN(created_at))),
           0
         ) AS oldest_age_seconds
       FROM edge_provisioning_jobs
       WHERE status IN ('PENDING', 'FAILED')
         AND attempt_count < max_attempts`,
    );
    const row = res.rows[0];
    return {
      pending: Number(row?.pending ?? 0),
      oldestAgeSeconds: Number(row?.oldest_age_seconds ?? 0),
    };
  }
}

function mapRow(row: Record<string, unknown>): ProvisioningJob {
  return {
    id: String(row.id),
    subscriptionId: String(row.subscription_id),
    jobType: row.job_type as ProvisioningJob['jobType'],
    status: row.status as ProvisioningJob['status'],
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? 8),
    nextAttemptAt: new Date(String(row.next_attempt_at)),
    lastError: row.last_error == null ? null : String(row.last_error),
    checkpoint: (row.checkpoint as Record<string, unknown>) ?? {},
    payload: (row.payload as Record<string, unknown>) ?? {},
    correlationId: row.correlation_id == null ? null : String(row.correlation_id),
    idempotencyKey: row.idempotency_key == null ? null : String(row.idempotency_key),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
    completedAt: row.completed_at ? new Date(String(row.completed_at)) : null,
  };
}
