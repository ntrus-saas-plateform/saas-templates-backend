/**
 * RGOM E1/E2 — idempotent Syntix Pharma commercial beachhead seed.
 *
 * Seeds vertical PHARMACY, product SYNTIX_PHARMA, segments, profiles, operating models,
 * capabilities, ICPs, personas, value props, packages, plans Lite→Enterprise (with
 * entitlementSnapshot in plan.metadata), add-ons, pricing units.
 * Does NOT invent price amounts (price books stay DRAFT / NEEDS_RESEARCH).
 *
 * Usage:
 *   pnpm seed:rgom:syntix
 *   pnpm exec tsx scripts/seed-rgom-syntix-pharma.ts
 */
import pg from 'pg';
import { loadEnvFile } from './load-env.js';
import {
  SYNTIX_ADDONS,
  SYNTIX_CAPABILITIES,
  SYNTIX_ICPS,
  SYNTIX_OPERATING_MODELS,
  SYNTIX_PACKAGES,
  SYNTIX_PERSONAS,
  SYNTIX_PLANS,
  SYNTIX_PRICING_UNITS,
  SYNTIX_PRODUCT_CODE,
  SYNTIX_PROFILES,
  SYNTIX_SEGMENTS,
  SYNTIX_VALUE_PROPOSITIONS,
  SYNTIX_VERTICAL_CODE,
  planEntitlementSnapshot,
} from '../src/modules/edge/domain/commercial/syntix-pharma-catalog.seed.js';

loadEnvFile();

function controlPool(): pg.Pool {
  if (process.env.DATABASE_URL?.trim()) {
    return new pg.Pool({ connectionString: process.env.DATABASE_URL.trim() });
  }
  return new pg.Pool({
    host: process.env.CONTROL_PLANE_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.CONTROL_PLANE_DB_PORT ?? 5432),
    database: process.env.CONTROL_PLANE_DB_NAME ?? 'platform_control',
    user: process.env.CONTROL_PLANE_DB_USER ?? 'postgres',
    password: process.env.CONTROL_PLANE_DB_PASSWORD ?? 'postgres',
  });
}

async function upsertCapability(
  client: pg.PoolClient,
  cap: (typeof SYNTIX_CAPABILITIES)[number],
): Promise<string> {
  const res = await client.query<{ id: string }>(
    `INSERT INTO edge_technical_capabilities (
       code, name, category, technical_status, commercial_availability, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (code) DO UPDATE SET
       name = EXCLUDED.name,
       category = EXCLUDED.category,
       technical_status = EXCLUDED.technical_status,
       commercial_availability = EXCLUDED.commercial_availability,
       metadata = edge_technical_capabilities.metadata || EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING id`,
    [
      cap.code,
      cap.name,
      cap.category,
      cap.technicalStatus,
      cap.commercialAvailability,
      JSON.stringify({
        rgom: 'syntix-beachhead',
        entitlementKind: cap.entitlementKind,
        defaultEnabled: cap.defaultEnabled ?? null,
        defaultLimit: cap.defaultLimit ?? null,
      }),
    ],
  );
  return res.rows[0].id;
}

async function linkPackageCaps(
  client: pg.PoolClient,
  packageId: string,
  capabilityCodes: readonly string[],
  capIds: Map<string, string>,
): Promise<void> {
  for (const code of capabilityCodes) {
    const capId = capIds.get(code);
    if (!capId) continue;
    await client.query(
      `INSERT INTO edge_solution_package_capabilities (package_id, capability_id, inclusion_type)
       VALUES ($1, $2, 'INCLUDED')
       ON CONFLICT (package_id, capability_id) DO NOTHING`,
      [packageId, capId],
    );
  }
}

async function linkPlanCaps(
  client: pg.PoolClient,
  planId: string,
  capabilityCodes: readonly string[],
  quotas: Readonly<Record<string, number>>,
  capIds: Map<string, string>,
): Promise<void> {
  for (const code of capabilityCodes) {
    const capId = capIds.get(code);
    if (!capId) continue;
    await client.query(
      `INSERT INTO edge_commercial_plan_capabilities (plan_id, capability_id, inclusion_type)
       VALUES ($1, $2, 'INCLUDED')
       ON CONFLICT (plan_id, capability_id) DO NOTHING`,
      [planId, capId],
    );
  }
  for (const quotaCode of Object.keys(quotas)) {
    const capId = capIds.get(quotaCode);
    if (!capId) continue;
    await client.query(
      `INSERT INTO edge_commercial_plan_capabilities (
         plan_id, capability_id, inclusion_type, restrictions
       ) VALUES ($1, $2, 'INCLUDED', $3::jsonb)
       ON CONFLICT (plan_id, capability_id) DO UPDATE SET
         restrictions = EXCLUDED.restrictions`,
      [planId, capId, JSON.stringify({ numericLimit: quotas[quotaCode] })],
    );
  }
}

async function main(): Promise<void> {
  const pool = controlPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const vertical = await client.query<{ id: string }>(
      `INSERT INTO edge_verticals (code, slug, display_name, status)
       VALUES ($1, 'pharmacy', 'Pharmacy', 'ACTIVE')
       ON CONFLICT (code) DO UPDATE SET
         status = 'ACTIVE',
         display_name = EXCLUDED.display_name,
         updated_at = NOW()
       RETURNING id`,
      [SYNTIX_VERTICAL_CODE],
    );
    const verticalId = vertical.rows[0].id;
    console.log(`vertical ${SYNTIX_VERTICAL_CODE} id=${verticalId}`);

    const product = await client.query<{ id: string }>(
      `INSERT INTO edge_products (
         code, slug, name, short_description, vertical_id,
         lifecycle_status, commercial_availability, product_type, metadata
       ) VALUES (
         $1, 'syntix-pharma', 'Syntix Pharma',
         'Beachhead commercial product — retail pharmacy + wholesale/distribution',
         $2, 'PUBLISHED', 'AVAILABLE', 'SAAS',
         $3::jsonb
       )
       ON CONFLICT (code) DO UPDATE SET
         lifecycle_status = 'PUBLISHED',
         commercial_availability = 'AVAILABLE',
         name = EXCLUDED.name,
         short_description = EXCLUDED.short_description,
         metadata = edge_products.metadata || EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING id`,
      [
        SYNTIX_PRODUCT_CODE,
        verticalId,
        JSON.stringify({
          rgom: true,
          beachhead: 'syntix',
          multiEstablishmentSemantics: 'same-product-establishments',
        }),
      ],
    );
    const productId = product.rows[0].id;
    console.log(`product ${SYNTIX_PRODUCT_CODE} id=${productId}`);

    const segmentIds = new Map<string, string>();
    for (const seg of SYNTIX_SEGMENTS) {
      const row = await client.query<{ id: string }>(
        `INSERT INTO edge_market_segments (code, name, vertical_id, status, metadata)
         VALUES ($1, $2, $3, 'ACTIVE', '{"rgom":"syntix-beachhead"}'::jsonb)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           status = 'ACTIVE',
           updated_at = NOW()
         RETURNING id`,
        [seg.code, seg.name, verticalId],
      );
      segmentIds.set(seg.code, row.rows[0].id);
    }
    console.log(`segments ${segmentIds.size}`);

    for (const profile of SYNTIX_PROFILES) {
      await client.query(
        `INSERT INTO edge_business_profile_templates (
           code, name, vertical_id, segment_id, status, metadata
         ) VALUES ($1, $2, $3, $4, 'ACTIVE', '{"rgom":"syntix-beachhead"}'::jsonb)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           segment_id = EXCLUDED.segment_id,
           status = 'ACTIVE',
           updated_at = NOW()`,
        [profile.code, profile.name, verticalId, segmentIds.get(profile.segmentCode) ?? null],
      );
    }
    console.log(`profiles ${SYNTIX_PROFILES.length}`);

    for (const om of SYNTIX_OPERATING_MODELS) {
      await client.query(
        `INSERT INTO edge_operating_models (
           code, name, dimension, vertical_id, status, metadata
         ) VALUES ($1, $2, $3, $4, 'ACTIVE', '{"rgom":"syntix-beachhead"}'::jsonb)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           dimension = EXCLUDED.dimension,
           status = 'ACTIVE',
           updated_at = NOW()`,
        [om.code, om.name, om.dimension, verticalId],
      );
    }
    console.log(`operating models ${SYNTIX_OPERATING_MODELS.length}`);

    const capIds = new Map<string, string>();
    for (const cap of SYNTIX_CAPABILITIES) {
      const id = await upsertCapability(client, cap);
      capIds.set(cap.code, id);
      await client.query(
        `INSERT INTO edge_product_capability_mappings (
           product_id, capability_id, classification, technical_status, commercial_availability
         )
         SELECT $1, $2, 'SUPPORTED', $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM edge_product_capability_mappings m
           WHERE m.product_id = $1
             AND m.capability_id = $2
             AND m.product_version_id IS NULL
         )`,
        [productId, id, cap.technicalStatus, cap.commercialAvailability],
      );
    }
    console.log(`capabilities ${capIds.size}`);

    const icpIds = new Map<string, string>();
    for (const icp of SYNTIX_ICPS) {
      const row = await client.query<{ id: string }>(
        `INSERT INTO edge_icp_definitions (
           code, name, vertical_id, product_id, status, attributes, scoring, metadata
         ) VALUES (
           $1, $2, $3, $4, 'ACTIVE',
           $5::jsonb, '{"model":"scorecard-v0","confidence":"NEEDS_RESEARCH"}'::jsonb,
           '{"rgom":"syntix-beachhead"}'::jsonb
         )
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           status = 'ACTIVE',
           updated_at = NOW()
         RETURNING id`,
        [
          icp.code,
          icp.name,
          verticalId,
          productId,
          JSON.stringify({ segmentCode: icp.segmentCode }),
        ],
      );
      icpIds.set(icp.code, row.rows[0].id);
      const segId = segmentIds.get(icp.segmentCode);
      if (segId) {
        await client.query(
          `INSERT INTO edge_icp_segment_links (icp_id, segment_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [row.rows[0].id, segId],
        );
      }
    }
    console.log(`icps ${icpIds.size}`);

    for (const persona of SYNTIX_PERSONAS) {
      await client.query(
        `INSERT INTO edge_persona_definitions (
           code, name, role_label, vertical_id, product_id, status, metadata
         ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', '{"rgom":"syntix-beachhead"}'::jsonb)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           role_label = EXCLUDED.role_label,
           status = 'ACTIVE',
           updated_at = NOW()`,
        [persona.code, persona.name, persona.roleLabel, verticalId, productId],
      );
    }
    console.log(`personas ${SYNTIX_PERSONAS.length}`);

    for (const vp of SYNTIX_VALUE_PROPOSITIONS) {
      await client.query(
        `INSERT INTO edge_value_propositions (
           code, name, product_id, vertical_id, segment_id, status,
           customer_problem, proposed_solution, expected_outcome, differentiation,
           validation_status, metadata
         ) VALUES (
           $1, $2, $3, $4, $5, 'ACTIVE',
           $6, $7, $8, $9,
           'UNVALIDATED',
           '{"rgom":"syntix-beachhead","competitiveNotes":"NEEDS_RESEARCH"}'::jsonb
         )
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           customer_problem = EXCLUDED.customer_problem,
           proposed_solution = EXCLUDED.proposed_solution,
           expected_outcome = EXCLUDED.expected_outcome,
           differentiation = EXCLUDED.differentiation,
           status = 'ACTIVE',
           updated_at = NOW()`,
        [
          vp.code,
          vp.name,
          productId,
          verticalId,
          segmentIds.get(vp.segmentCode) ?? null,
          vp.customerProblem,
          vp.proposedSolution,
          vp.expectedOutcome,
          vp.differentiation,
        ],
      );
    }
    console.log(`value propositions ${SYNTIX_VALUE_PROPOSITIONS.length}`);

    const packageIds = new Map<string, string>();
    for (const pkg of SYNTIX_PACKAGES) {
      const row = await client.query<{ id: string }>(
        `INSERT INTO edge_solution_packages (
           code, name, product_id, vertical_id, package_type, status, metadata
         ) VALUES (
           $1, $2, $3, $4, 'SOLUTION', 'PUBLISHED',
           '{"rgom":"syntix-beachhead"}'::jsonb
         )
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           status = 'PUBLISHED',
           updated_at = NOW()
         RETURNING id`,
        [pkg.code, pkg.name, productId, verticalId],
      );
      packageIds.set(pkg.code, row.rows[0].id);
      await linkPackageCaps(client, row.rows[0].id, pkg.capabilityCodes, capIds);
    }
    console.log(`packages ${packageIds.size}`);

    const planIds = new Map<string, string>();
    for (const plan of SYNTIX_PLANS) {
      const snapshot = planEntitlementSnapshot(plan.code);
      const row = await client.query<{ id: string }>(
        `INSERT INTO edge_commercial_plans (
           code, name, product_id, vertical_id, plan_tier, solution_package_id,
           status, metadata
         ) VALUES (
           $1, $2, $3, $4, $5, $6, 'PUBLISHED', $7::jsonb
         )
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           plan_tier = EXCLUDED.plan_tier,
           solution_package_id = EXCLUDED.solution_package_id,
           status = 'PUBLISHED',
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
         RETURNING id`,
        [
          plan.code,
          plan.name,
          productId,
          verticalId,
          plan.planTier,
          plan.packageCode ? (packageIds.get(plan.packageCode) ?? null) : null,
          JSON.stringify({
            rgom: 'syntix-beachhead',
            entitlementSnapshot: snapshot,
          }),
        ],
      );
      planIds.set(plan.code, row.rows[0].id);
      await linkPlanCaps(client, row.rows[0].id, plan.capabilityCodes, plan.quotas, capIds);
    }
    console.log(`plans ${planIds.size}`);

    for (const addon of SYNTIX_ADDONS) {
      const row = await client.query<{ id: string }>(
        `INSERT INTO edge_commercial_addons (
           code, name, product_id, addon_type, status, eligibility, metadata
         ) VALUES (
           $1, $2, $3, 'CAPABILITY', 'PUBLISHED',
           '{"compatiblePlanTiers":["PROFESSIONAL","BUSINESS","ENTERPRISE"]}'::jsonb,
           '{"rgom":"syntix-beachhead"}'::jsonb
         )
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           status = 'PUBLISHED',
           updated_at = NOW()
         RETURNING id`,
        [addon.code, addon.name, productId],
      );
      for (const code of addon.capabilityCodes) {
        const capId = capIds.get(code);
        if (!capId) continue;
        await client.query(
          `INSERT INTO edge_commercial_addon_capabilities (addon_id, capability_id, inclusion_type)
           VALUES ($1, $2, 'INCLUDED')
           ON CONFLICT (addon_id, capability_id) DO NOTHING`,
          [row.rows[0].id, capId],
        );
      }
      for (const plan of SYNTIX_PLANS) {
        if (plan.planTier === 'LITE') continue;
        const planId = planIds.get(plan.code);
        if (!planId) continue;
        await client.query(
          `INSERT INTO edge_commercial_addon_plan_links (addon_id, plan_id, compatibility)
           VALUES ($1, $2, 'COMPATIBLE')
           ON CONFLICT DO NOTHING`,
          [row.rows[0].id, planId],
        );
      }
    }
    console.log(`addons ${SYNTIX_ADDONS.length}`);

    for (const unit of SYNTIX_PRICING_UNITS) {
      await client.query(
        `INSERT INTO edge_pricing_units (code, name, unit_category, status, metadata)
         VALUES ($1, $2, $3, 'ACTIVE', '{"rgom":"syntix-beachhead"}'::jsonb)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           unit_category = EXCLUDED.unit_category,
           status = 'ACTIVE'`,
        [unit.code, unit.name, unit.unitCategory],
      );
    }
    // Price book shell only — no invented amounts
    await client.query(
      `INSERT INTO edge_price_books (
         code, name, product_id, currency, status, metadata
       ) VALUES (
         'PB_SYNTIX_BEACHHEAD',
         'Syntix Pharma beachhead price book',
         $1, 'XOF', 'DRAFT',
         '{"rgom":"syntix-beachhead","researchStatus":"NEEDS_RESEARCH","note":"no invented prices"}'::jsonb
       )
       ON CONFLICT (code) DO UPDATE SET
         metadata = edge_price_books.metadata || EXCLUDED.metadata,
         updated_at = NOW()`,
      [productId],
    );
    console.log('pricing units + draft price book (no amounts)');

    await client.query('COMMIT');
    console.log(productId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
