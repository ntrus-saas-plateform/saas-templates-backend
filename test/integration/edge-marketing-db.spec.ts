import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import {
  applyControlPlaneMigrations,
  listControlPlaneMigrationFiles,
} from '../helpers/control-plane-migrate.js';
import {
  assertCampaignCanPromoteProduct,
  assertCampaignPublishable,
  calculateExplainableLeadScore,
  CampaignStatus,
  normalizeLeadEmail,
} from '../../src/modules/edge/domain/marketing/marketing.entity.js';
import { DomainError } from '../../src/core/domain/errors/domain-error.js';

describe.skipIf(!runTestcontainers)('P3 Edge Marketing DB (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('platform_control_marketing')
      .withUsername('platform')
      .withPassword('platform')
      .start();
    pool = new pg.Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: container.getDatabase(),
      user: container.getUsername(),
      password: container.getPassword(),
    });
  }, 300_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('lists 080 after 079', () => {
    const files = listControlPlaneMigrationFiles();
    const i076 = files.indexOf('076_edge_commercial_governance_extensions.sql');
    const i077 = files.indexOf('077_edge_marketing_foundation.sql');
    const i078 = files.indexOf('078_edge_marketing_orchestration.sql');
    const i079 = files.indexOf('079_edge_marketing_ops_hardening.sql');
    const i080 = files.indexOf('080_edge_marketing_resend_indexes.sql');
    expect(i076).toBeGreaterThanOrEqual(0);
    expect(i077).toBeGreaterThan(i076);
    expect(i078).toBeGreaterThan(i077);
    expect(i079).toBeGreaterThan(i078);
    expect(i080).toBeGreaterThan(i079);
  });

  it('applies 077–080 and enforces marketing integrity', async () => {
    const result = await applyControlPlaneMigrations(pool);
    expect(result.applied).toContain('077_edge_marketing_foundation');
    expect(result.applied).toContain('078_edge_marketing_orchestration');
    expect(result.applied).toContain('079_edge_marketing_ops_hardening');
    expect(result.applied).toContain('080_edge_marketing_resend_indexes');

    for (const table of [
      'edge_marketing_strategies',
      'edge_marketing_audiences',
      'edge_marketing_campaigns',
      'edge_marketing_form_definitions',
      'edge_marketing_leads',
      'edge_marketing_lead_consents',
      'edge_marketing_scoring_models',
      'edge_marketing_budgets',
      'edge_marketing_journeys',
      'edge_marketing_delivery_attempts',
      'edge_marketing_attribution_models',
      'edge_marketing_frequency_policies',
      'edge_marketing_journey_wait_schedules',
    ]) {
      const exists = await pool.query(
        `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
        [table],
      );
      expect(exists.rowCount).toBe(1);
    }

    const perms = await pool.query(
      `SELECT count(*)::int AS c FROM edge_permissions WHERE code LIKE 'platform:marketing:%'`,
    );
    expect(perms.rows[0].c).toBeGreaterThanOrEqual(20);

    const model = await pool.query(
      `SELECT code, version FROM edge_marketing_scoring_models WHERE code = 'DEFAULT_MQL'`,
    );
    expect(model.rows[0].version).toBe(1);

    const vertical = await pool.query<{ id: string }>(
      `INSERT INTO edge_verticals (code, slug, display_name, status)
       VALUES ('p3-v', 'p3-v', 'P3 Vertical', 'ACTIVE') RETURNING id`,
    );
    const product = await pool.query<{ id: string }>(
      `INSERT INTO edge_products (code, slug, name, vertical_id, lifecycle_status, commercial_availability)
       VALUES ('p3-prod', 'p3-prod', 'P3 Product', $1, 'PUBLISHED', 'AVAILABLE')
       RETURNING id`,
      [vertical.rows[0].id],
    );

    expect(() =>
      assertCampaignCanPromoteProduct({
        productLifecycleStatus: 'PUBLISHED',
        commercialAvailability: 'AVAILABLE',
      }),
    ).not.toThrow();
    expect(() =>
      assertCampaignCanPromoteProduct({
        productLifecycleStatus: 'PUBLISHED',
        commercialAvailability: 'UNAVAILABLE',
      }),
    ).toThrow(DomainError);

    const campaign = await pool.query<{ id: string }>(
      `INSERT INTO edge_marketing_campaigns (code, name, campaign_type, product_id, status)
       VALUES ('p3-c1', 'Demo Drive', 'DEMO_REQUEST', $1, 'DRAFT') RETURNING id`,
      [product.rows[0].id],
    );

    await pool.query(
      `INSERT INTO edge_marketing_campaign_approvals (
         campaign_id, campaign_version, approval_type, decision
       ) VALUES ($1, 1, 'FINAL', 'APPROVED')`,
      [campaign.rows[0].id],
    );

    expect(() =>
      assertCampaignPublishable({
        status: CampaignStatus.APPROVED,
        finalApprovalDecision: 'APPROVED',
      }),
    ).not.toThrow();

    const form = await pool.query<{ id: string }>(
      `INSERT INTO edge_marketing_form_definitions (
         code, name, form_type, slug, product_id, status
       ) VALUES ('p3-f1', 'Demo form', 'DEMO_REQUEST', 'p3-demo', $1, 'PUBLISHED')
       RETURNING id`,
      [product.rows[0].id],
    );

    const email = normalizeLeadEmail('Lead@Okapi.io');
    const lead = await pool.query<{ id: string }>(
      `INSERT INTO edge_marketing_leads (email_normalized, primary_product_id, source_form_id, status)
       VALUES ($1, $2, $3, 'NEW') RETURNING id`,
      [email, product.rows[0].id, form.rows[0].id],
    );

    await pool.query(
      `INSERT INTO edge_marketing_form_submissions (
         form_id, form_version, idempotency_key, lead_id, payload, status
       ) VALUES ($1, 1, 'idem-1', $2, '{"email":"Lead@Okapi.io"}'::jsonb, 'PROCESSED')`,
      [form.rows[0].id, lead.rows[0].id],
    );

    await expect(
      pool.query(
        `INSERT INTO edge_marketing_form_submissions (
           form_id, form_version, idempotency_key, lead_id, payload, status
         ) VALUES ($1, 1, 'idem-1', $2, '{}'::jsonb, 'PROCESSED')`,
        [form.rows[0].id, lead.rows[0].id],
      ),
    ).rejects.toThrow();

    await expect(
      pool.query(
        `INSERT INTO edge_marketing_budgets (
           code, name, scope_type, currency, planned_amount
         ) VALUES ('p3-b1', 'Bad', 'GLOBAL', 'USD', -1)`,
      ),
    ).rejects.toThrow();

    const scored = calculateExplainableLeadScore({
      modelVersion: 1,
      weights: { demoRequest: 30, icpMatch: 25 },
      signals: { demoRequest: true, icpMatch: true },
    });
    expect(scored.score).toBe(55);
  }, 180_000);
});
