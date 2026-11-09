import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import { applyControlPlaneMigrations } from '../helpers/control-plane-migrate.js';
import {
  assertPublicationAllowed,
  CommercialInclusionType,
  CommercialReadinessResult,
  evaluateCommercialReadiness,
} from '../../src/modules/edge/domain/commercial/commercial.entity.js';
import { calculateCommercialPrice } from '../../src/modules/edge/domain/commercial/pricing-math.js';
import {
  configureCommercialOffer,
  EligibilityDecision,
  OfferConfiguratorMode,
} from '../../src/modules/edge/domain/commercial/offer-configurator.js';
import { DomainError, ErrorCode } from '../../src/core/domain/errors/domain-error.js';
import { assertProductVerticalAccess } from '../../src/modules/edge/domain/product/product-vertical-access.js';

/**
 * P2 scenarios A–F — domain + DB integrity (no Keycloak).
 * Authenticated Playwright A–F remain gated on EDGE_E2E_AUTH.
 */
describe.skipIf(!runTestcontainers)('P2 commercial scenarios A–F (DB+domain)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;
  let verticalId: string;
  let productId: string;
  let capabilityId: string;
  let planId: string;
  let packageId: string;
  let priceBookId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('platform_control_p2_scenarios')
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
    await applyControlPlaneMigrations(pool);

    const vertical = await pool.query<{ id: string }>(
      `INSERT INTO edge_verticals (code, slug, display_name, status)
       VALUES ('p2sc-v', 'p2sc-v', 'P2 Scenario Vertical', 'ACTIVE') RETURNING id`,
    );
    verticalId = vertical.rows[0].id;

    const product = await pool.query<{ id: string }>(
      `INSERT INTO edge_products (code, slug, name, vertical_id, lifecycle_status, commercial_availability)
       VALUES ('p2sc-prod', 'p2sc-prod', 'P2 Scenario Product', $1, 'PUBLISHED', 'AVAILABLE')
       RETURNING id`,
      [verticalId],
    );
    productId = product.rows[0].id;

    const cap = await pool.query<{ id: string }>(
      `INSERT INTO edge_technical_capabilities (code, name, technical_status, commercial_availability)
       VALUES ('p2sc-cap', 'Scenario Cap', 'VALIDATED', 'AVAILABLE') RETURNING id`,
    );
    capabilityId = cap.rows[0].id;
  }, 300_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('Scenario A — build commercial offer composition', async () => {
    const pkg = await pool.query<{ id: string }>(
      `INSERT INTO edge_solution_packages (code, name, product_id, vertical_id, status)
       VALUES ('p2sc-pkg', 'Core Package', $1, $2, 'DRAFT') RETURNING id`,
      [productId, verticalId],
    );
    packageId = pkg.rows[0].id;

    await pool.query(
      `INSERT INTO edge_solution_package_capabilities (package_id, capability_id, inclusion_type)
       VALUES ($1, $2, 'INCLUDED')`,
      [packageId, capabilityId],
    );

    const plan = await pool.query<{ id: string }>(
      `INSERT INTO edge_commercial_plans (code, name, product_id, vertical_id, plan_tier, solution_package_id, status)
       VALUES ('p2sc-pro', 'Professional', $1, $2, 'PROFESSIONAL', $3, 'DRAFT') RETURNING id`,
      [productId, verticalId, packageId],
    );
    planId = plan.rows[0].id;

    await pool.query(
      `INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
       VALUES ($1, $2, 'INCLUDED')`,
      [planId, capabilityId],
    );

    const book = await pool.query<{ id: string }>(
      `INSERT INTO edge_price_books (code, name, product_id, currency, geographic_scope, status)
       VALUES ('p2sc-usd', 'USD Book', $1, 'USD', 'US', 'DRAFT') RETURNING id`,
      [productId],
    );
    priceBookId = book.rows[0].id;

    await pool.query(
      `INSERT INTO edge_price_book_entries (price_book_id, commercial_item_type, commercial_item_id, currency, amount)
       VALUES ($1, 'PLAN', $2, 'USD', 99.000000)`,
      [priceBookId, planId],
    );

    const readiness = evaluateCommercialReadiness({
      productLifecycleStatus: 'PUBLISHED',
      hasPlanTier: true,
      capabilityRefs: [
        {
          capabilityId,
          technicalStatus: 'VALIDATED',
          commercialAvailability: 'AVAILABLE',
        },
      ],
      inclusions: [
        { capabilityId, inclusionType: CommercialInclusionType.INCLUDED },
      ],
      priceBookCurrency: 'USD',
      requireCurrencyOnPriceBook: true,
    });
    expect(readiness.result).toBe(CommercialReadinessResult.READY);
    assertPublicationAllowed(readiness.result);

    await pool.query(
      `UPDATE edge_commercial_plans SET status = 'PUBLISHED', version = version + 1 WHERE id = $1`,
      [planId],
    );
    const snap = await pool.query(
      `INSERT INTO edge_commercial_publication_snapshots (offer_type, offer_id, product_id, snapshot)
       VALUES ('PLAN', $1, $2, $3::jsonb) RETURNING id`,
      [planId, productId, JSON.stringify({ planId, priceBookId, readiness })],
    );
    expect(snap.rows[0].id).toBeTruthy();

    const preview = calculateCommercialPrice({
      baseAmount: '99.00',
      currency: 'USD',
      quantity: 2,
      modelType: 'PER_USER',
    });
    expect(preview.amount).toBe('198.00');
  }, 120_000);

  it('Scenario B — invalid commercial offer is blocked', () => {
    const readiness = evaluateCommercialReadiness({
      productLifecycleStatus: 'DRAFT',
      hasPlanTier: true,
      capabilityRefs: [
        {
          capabilityId: 'bad',
          technicalStatus: 'PLANNED',
          commercialAvailability: 'AVAILABLE',
        },
      ],
      inclusions: [
        { capabilityId: 'bad', inclusionType: CommercialInclusionType.INCLUDED },
      ],
      priceBookCurrency: null,
      requireCurrencyOnPriceBook: true,
    });
    expect(readiness.result).toBe(CommercialReadinessResult.BLOCKED);
    expect(() => assertPublicationAllowed(readiness.result)).toThrow(DomainError);

    const config = configureCommercialOffer({
      mode: OfferConfiguratorMode.MANUAL_CONFIGURATION,
      productId: 'p1',
      productLifecycleStatus: 'PUBLISHED',
      planId: 'plan-x',
      planProductId: 'p2',
      planStatus: 'DRAFT',
      capabilityRefs: [],
      inclusions: [],
      rulesVersion: 1,
    });
    expect(config.decision).toBe(EligibilityDecision.INELIGIBLE);
    expect(config.grantsEntitlements).toBe(false);
  });

  it('Scenario C — geographic price books with distinct currencies', async () => {
    const eu = await pool.query<{ id: string }>(
      `INSERT INTO edge_price_books (code, name, product_id, currency, geographic_scope, status)
       VALUES ('p2sc-eur', 'EUR Book', $1, 'EUR', 'EU', 'DRAFT') RETURNING id`,
      [productId],
    );
    await pool.query(
      `INSERT INTO edge_price_book_entries (price_book_id, commercial_item_type, commercial_item_id, currency, amount)
       VALUES ($1, 'PLAN', $2, 'EUR', 89.000000)`,
      [eu.rows[0].id, planId],
    );

    const books = await pool.query(
      `SELECT code, currency, geographic_scope FROM edge_price_books
       WHERE product_id = $1 ORDER BY code`,
      [productId],
    );
    expect(books.rows.map((r) => r.currency).sort()).toEqual(['EUR', 'USD']);
    expect(books.rows.find((r) => r.currency === 'USD')?.geographic_scope).toBe('US');
    expect(books.rows.find((r) => r.currency === 'EUR')?.geographic_scope).toBe('EU');
  });

  it('Scenario D — enterprise template requires deployment profile', async () => {
    const blocked = evaluateCommercialReadiness({
      productLifecycleStatus: 'PUBLISHED',
      hasPlanTier: false,
      requirePlanTier: false,
      capabilityRefs: [],
      inclusions: [],
      requireDeploymentProfile: true,
      hasDeploymentProfile: false,
    });
    expect(blocked.blockers).toContain('deployment_profile_missing');

    const ready = evaluateCommercialReadiness({
      productLifecycleStatus: 'PUBLISHED',
      hasPlanTier: false,
      requirePlanTier: false,
      capabilityRefs: [],
      inclusions: [],
      requireDeploymentProfile: true,
      hasDeploymentProfile: true,
    });
    expect(ready.result).toBe(CommercialReadinessResult.READY);

    const ent = await pool.query<{ id: string }>(
      `INSERT INTO edge_enterprise_offer_templates (
         code, name, product_id, vertical_id, solution_package_id, deployment_profile, status
       ) VALUES (
         'p2sc-ent', 'Enterprise Template', $1, $2, $3,
         '{"mode":"DEDICATED","region":"EU"}'::jsonb, 'DRAFT'
       ) RETURNING id`,
      [productId, verticalId, packageId],
    );
    expect(ent.rows[0].id).toBeTruthy();
  });

  it('Scenario E — vertical isolation blocks cross-vertical mutation', async () => {
    const other = await pool.query<{ id: string }>(
      `INSERT INTO edge_verticals (code, slug, display_name, status)
       VALUES ('p2sc-other', 'p2sc-other', 'Other Vertical', 'ACTIVE') RETURNING id`,
    );
    expect(() =>
      assertProductVerticalAccess({
        scopeVerticalId: other.rows[0].id,
        productVerticalId: verticalId,
        action: 'update',
      }),
    ).toThrow(DomainError);

    try {
      assertProductVerticalAccess({
        scopeVerticalId: other.rows[0].id,
        productVerticalId: verticalId,
        action: 'update',
      });
    } catch (err) {
      expect((err as DomainError).code).toBe(ErrorCode.FORBIDDEN);
    }

    // Product belongs to verticalId — ICP for other vertical must not match
    expect(verticalId).not.toBe(other.rows[0].id);
  });

  it('Scenario F — published snapshot remains immutable when plan changes', async () => {
    const before = await pool.query(
      `SELECT snapshot FROM edge_commercial_publication_snapshots
       WHERE offer_id = $1 ORDER BY published_at DESC LIMIT 1`,
      [planId],
    );
    const frozen = before.rows[0].snapshot;

    await pool.query(
      `UPDATE edge_commercial_plans SET name = 'Professional Renamed' WHERE id = $1`,
      [planId],
    );

    const after = await pool.query(
      `SELECT snapshot FROM edge_commercial_publication_snapshots
       WHERE offer_id = $1 ORDER BY published_at DESC LIMIT 1`,
      [planId],
    );
    expect(after.rows[0].snapshot).toEqual(frozen);
  });
});
