import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CommercialAddon,
  CommercialMarket,
  CommercialPlan,
  CommercialReadinessEvaluation,
  CommercialRepositoryPort,
  IcpDefinition,
  PriceBook,
  PriceBookEntry,
  SolutionPackage,
} from '../../domain/ports/commercial-repository.port.js';
import type {
  CommercialInclusionType,
  CommercialReadinessResult,
  PlanTier,
} from '../../domain/commercial/commercial.entity.js';

@Injectable()
export class PgCommercialRepository implements CommercialRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async createMarket(input: {
    code: string;
    name: string;
    description?: string | null;
    verticalId: string;
    geographicScope?: string | null;
    marketCategory?: string | null;
    ownerRef?: string | null;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<CommercialMarket> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_commercial_markets (
         id, code, name, description, vertical_id, geographic_scope,
         market_category, owner_ref, metadata, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
       RETURNING *`,
      [
        id,
        input.code,
        input.name,
        input.description ?? null,
        input.verticalId,
        input.geographicScope ?? null,
        input.marketCategory ?? null,
        input.ownerRef ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy ?? null,
      ],
    );
    return this.mapMarket(result.rows[0]);
  }

  async listMarkets(input: {
    page: number;
    limit: number;
    verticalId?: string;
  }): Promise<{ items: readonly CommercialMarket[]; total: number }> {
    const offset = (Math.max(input.page, 1) - 1) * input.limit;
    if (input.verticalId) {
      const count = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM edge_commercial_markets WHERE vertical_id = $1`,
        [input.verticalId],
      );
      const result = await this.pool.query(
        `SELECT * FROM edge_commercial_markets
         WHERE vertical_id = $1
         ORDER BY code
         LIMIT $2 OFFSET $3`,
        [input.verticalId, input.limit, offset],
      );
      return {
        items: result.rows.map((r) => this.mapMarket(r)),
        total: Number(count.rows[0]?.count ?? 0),
      };
    }
    const count = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM edge_commercial_markets`,
    );
    const result = await this.pool.query(
      `SELECT * FROM edge_commercial_markets ORDER BY code LIMIT $1 OFFSET $2`,
      [input.limit, offset],
    );
    return {
      items: result.rows.map((r) => this.mapMarket(r)),
      total: Number(count.rows[0]?.count ?? 0),
    };
  }

  async getMarket(id: string): Promise<CommercialMarket | null> {
    const result = await this.pool.query(
      `SELECT * FROM edge_commercial_markets WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.mapMarket(result.rows[0]) : null;
  }

  async createIcp(input: {
    code: string;
    name: string;
    description?: string | null;
    verticalId: string;
    productId: string;
    attributes?: Record<string, unknown>;
    scoring?: Record<string, unknown>;
    segmentIds?: readonly string[];
    createdBy?: string | null;
  }): Promise<IcpDefinition> {
    const id = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO edge_icp_definitions (
           id, code, name, description, vertical_id, product_id,
           attributes, scoring, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)
         RETURNING *`,
        [
          id,
          input.code,
          input.name,
          input.description ?? null,
          input.verticalId,
          input.productId,
          JSON.stringify(input.attributes ?? {}),
          JSON.stringify(input.scoring ?? {}),
          input.createdBy ?? null,
        ],
      );
      for (const segmentId of input.segmentIds ?? []) {
        await client.query(
          `INSERT INTO edge_icp_segment_links (icp_id, segment_id) VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [id, segmentId],
        );
      }
      await client.query('COMMIT');
      return this.mapIcp(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listIcps(productId?: string): Promise<readonly IcpDefinition[]> {
    if (productId) {
      const result = await this.pool.query(
        `SELECT * FROM edge_icp_definitions WHERE product_id = $1 ORDER BY code`,
        [productId],
      );
      return result.rows.map((r) => this.mapIcp(r));
    }
    const result = await this.pool.query(
      `SELECT * FROM edge_icp_definitions ORDER BY code`,
    );
    return result.rows.map((r) => this.mapIcp(r));
  }

  async getIcp(id: string): Promise<IcpDefinition | null> {
    const result = await this.pool.query(
      `SELECT * FROM edge_icp_definitions WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.mapIcp(result.rows[0]) : null;
  }

  async createPackage(input: {
    code: string;
    name: string;
    description?: string | null;
    productId: string;
    verticalId: string;
    packageType?: string | null;
    createdBy?: string | null;
  }): Promise<SolutionPackage> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_solution_packages (
         id, code, name, description, product_id, vertical_id, package_type, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        id,
        input.code,
        input.name,
        input.description ?? null,
        input.productId,
        input.verticalId,
        input.packageType ?? null,
        input.createdBy ?? null,
      ],
    );
    return this.mapPackage(result.rows[0]);
  }

  async listPackages(productId?: string): Promise<readonly SolutionPackage[]> {
    if (productId) {
      const result = await this.pool.query(
        `SELECT * FROM edge_solution_packages WHERE product_id = $1 ORDER BY code`,
        [productId],
      );
      return result.rows.map((r) => this.mapPackage(r));
    }
    const result = await this.pool.query(
      `SELECT * FROM edge_solution_packages ORDER BY code`,
    );
    return result.rows.map((r) => this.mapPackage(r));
  }

  async getPackage(id: string): Promise<SolutionPackage | null> {
    const result = await this.pool.query(
      `SELECT * FROM edge_solution_packages WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.mapPackage(result.rows[0]) : null;
  }

  async addPackageCapability(input: {
    packageId: string;
    capabilityId: string;
    inclusionType: CommercialInclusionType;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO edge_solution_package_capabilities (
         id, package_id, capability_id, inclusion_type
       ) VALUES ($1,$2,$3,$4)
       ON CONFLICT (package_id, capability_id)
       DO UPDATE SET inclusion_type = EXCLUDED.inclusion_type`,
      [randomUUID(), input.packageId, input.capabilityId, input.inclusionType],
    );
  }

  async listPackageCapabilities(
    packageId: string,
  ): Promise<readonly { capabilityId: string; inclusionType: string }[]> {
    const result = await this.pool.query(
      `SELECT capability_id, inclusion_type
       FROM edge_solution_package_capabilities
       WHERE package_id = $1`,
      [packageId],
    );
    return result.rows.map((r) => ({
      capabilityId: r.capability_id as string,
      inclusionType: r.inclusion_type as string,
    }));
  }

  async createPlan(input: {
    code: string;
    name: string;
    description?: string | null;
    productId: string;
    verticalId: string;
    planTier: PlanTier;
    solutionPackageId?: string | null;
    createdBy?: string | null;
  }): Promise<CommercialPlan> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_commercial_plans (
         id, code, name, description, product_id, vertical_id,
         plan_tier, solution_package_id, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        id,
        input.code,
        input.name,
        input.description ?? null,
        input.productId,
        input.verticalId,
        input.planTier,
        input.solutionPackageId ?? null,
        input.createdBy ?? null,
      ],
    );
    return this.mapPlan(result.rows[0]);
  }

  async listPlans(productId?: string): Promise<readonly CommercialPlan[]> {
    if (productId) {
      const result = await this.pool.query(
        `SELECT * FROM edge_commercial_plans WHERE product_id = $1 ORDER BY plan_tier, code`,
        [productId],
      );
      return result.rows.map((r) => this.mapPlan(r));
    }
    const result = await this.pool.query(
      `SELECT * FROM edge_commercial_plans ORDER BY code`,
    );
    return result.rows.map((r) => this.mapPlan(r));
  }

  async getPlan(id: string): Promise<CommercialPlan | null> {
    const result = await this.pool.query(
      `SELECT * FROM edge_commercial_plans WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.mapPlan(result.rows[0]) : null;
  }

  async updatePlanStatus(id: string, status: string): Promise<CommercialPlan> {
    const result = await this.pool.query(
      `UPDATE edge_commercial_plans
       SET status = $2, updated_at = NOW(), version = version + 1
       WHERE id = $1
       RETURNING *`,
      [id, status],
    );
    return this.mapPlan(result.rows[0]);
  }

  async addPlanCapability(input: {
    planId: string;
    capabilityId: string;
    inclusionType: CommercialInclusionType;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO edge_commercial_plan_capabilities (
         id, plan_id, capability_id, inclusion_type
       ) VALUES ($1,$2,$3,$4)
       ON CONFLICT (plan_id, capability_id)
       DO UPDATE SET inclusion_type = EXCLUDED.inclusion_type`,
      [randomUUID(), input.planId, input.capabilityId, input.inclusionType],
    );
  }

  async listPlanCapabilities(
    planId: string,
  ): Promise<readonly { capabilityId: string; inclusionType: string }[]> {
    const result = await this.pool.query(
      `SELECT capability_id, inclusion_type
       FROM edge_commercial_plan_capabilities
       WHERE plan_id = $1`,
      [planId],
    );
    return result.rows.map((r) => ({
      capabilityId: r.capability_id as string,
      inclusionType: r.inclusion_type as string,
    }));
  }

  async createAddon(input: {
    code: string;
    name: string;
    description?: string | null;
    productId: string;
    addonType?: string;
    createdBy?: string | null;
  }): Promise<CommercialAddon> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_commercial_addons (
         id, code, name, description, product_id, addon_type, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        id,
        input.code,
        input.name,
        input.description ?? null,
        input.productId,
        input.addonType ?? 'CAPABILITY',
        input.createdBy ?? null,
      ],
    );
    return this.mapAddon(result.rows[0]);
  }

  async listAddons(productId?: string): Promise<readonly CommercialAddon[]> {
    if (productId) {
      const result = await this.pool.query(
        `SELECT * FROM edge_commercial_addons WHERE product_id = $1 ORDER BY code`,
        [productId],
      );
      return result.rows.map((r) => this.mapAddon(r));
    }
    const result = await this.pool.query(
      `SELECT * FROM edge_commercial_addons ORDER BY code`,
    );
    return result.rows.map((r) => this.mapAddon(r));
  }

  async getAddon(id: string): Promise<CommercialAddon | null> {
    const result = await this.pool.query(
      `SELECT * FROM edge_commercial_addons WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.mapAddon(result.rows[0]) : null;
  }

  async addAddonCapability(input: {
    addonId: string;
    capabilityId: string;
    inclusionType: CommercialInclusionType;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO edge_commercial_addon_capabilities (
         id, addon_id, capability_id, inclusion_type
       ) VALUES ($1,$2,$3,$4)
       ON CONFLICT (addon_id, capability_id)
       DO UPDATE SET inclusion_type = EXCLUDED.inclusion_type`,
      [randomUUID(), input.addonId, input.capabilityId, input.inclusionType],
    );
  }

  async listAddonCapabilities(
    addonId: string,
  ): Promise<readonly { capabilityId: string; inclusionType: string }[]> {
    const result = await this.pool.query(
      `SELECT capability_id, inclusion_type
       FROM edge_commercial_addon_capabilities
       WHERE addon_id = $1`,
      [addonId],
    );
    return result.rows.map((r) => ({
      capabilityId: r.capability_id as string,
      inclusionType: r.inclusion_type as string,
    }));
  }

  async linkAddonToPlan(input: {
    addonId: string;
    planId: string;
    compatibility: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO edge_commercial_addon_plan_links (addon_id, plan_id, compatibility)
       VALUES ($1,$2,$3)
       ON CONFLICT (addon_id, plan_id)
       DO UPDATE SET compatibility = EXCLUDED.compatibility`,
      [input.addonId, input.planId, input.compatibility],
    );
  }

  async createPricingUnit(input: {
    code: string;
    name: string;
    description?: string | null;
    unitCategory?: string | null;
  }): Promise<{ id: string; code: string; name: string }> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_pricing_units (id, code, name, description, unit_category)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, code, name`,
      [
        id,
        input.code,
        input.name,
        input.description ?? null,
        input.unitCategory ?? null,
      ],
    );
    return {
      id: result.rows[0].id as string,
      code: result.rows[0].code as string,
      name: result.rows[0].name as string,
    };
  }

  async listPricingUnits(): Promise<readonly { id: string; code: string; name: string }[]> {
    const result = await this.pool.query(
      `SELECT id, code, name FROM edge_pricing_units ORDER BY code`,
    );
    return result.rows.map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
    }));
  }

  async createPriceBook(input: {
    code: string;
    name: string;
    productId: string;
    currency: string;
    geographicScope?: string | null;
    createdBy?: string | null;
  }): Promise<PriceBook> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_price_books (
         id, code, name, product_id, currency, geographic_scope, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        id,
        input.code,
        input.name,
        input.productId,
        input.currency,
        input.geographicScope ?? null,
        input.createdBy ?? null,
      ],
    );
    return this.mapPriceBook(result.rows[0]);
  }

  async listPriceBooks(productId?: string): Promise<readonly PriceBook[]> {
    if (productId) {
      const result = await this.pool.query(
        `SELECT * FROM edge_price_books WHERE product_id = $1 ORDER BY code`,
        [productId],
      );
      return result.rows.map((r) => this.mapPriceBook(r));
    }
    const result = await this.pool.query(
      `SELECT * FROM edge_price_books ORDER BY code`,
    );
    return result.rows.map((r) => this.mapPriceBook(r));
  }

  async getPriceBook(id: string): Promise<PriceBook | null> {
    const result = await this.pool.query(
      `SELECT * FROM edge_price_books WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.mapPriceBook(result.rows[0]) : null;
  }

  async addPriceBookEntry(input: {
    priceBookId: string;
    commercialItemType: string;
    commercialItemId: string;
    currency: string;
    amount: string;
    billingFrequency?: string | null;
  }): Promise<PriceBookEntry> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_price_book_entries (
         id, price_book_id, commercial_item_type, commercial_item_id,
         currency, amount, billing_frequency
       ) VALUES ($1,$2,$3,$4,$5,$6::numeric,$7)
       RETURNING *`,
      [
        id,
        input.priceBookId,
        input.commercialItemType,
        input.commercialItemId,
        input.currency,
        input.amount,
        input.billingFrequency ?? null,
      ],
    );
    return this.mapPriceEntry(result.rows[0]);
  }

  async listPriceBookEntries(priceBookId: string): Promise<readonly PriceBookEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM edge_price_book_entries WHERE price_book_id = $1 ORDER BY created_at`,
      [priceBookId],
    );
    return result.rows.map((r) => this.mapPriceEntry(r));
  }

  async createReadinessEvaluation(input: {
    offerType: string;
    offerId: string;
    productId: string;
    result: CommercialReadinessResult;
    checks: readonly unknown[];
    blockers: readonly unknown[];
    warnings: readonly unknown[];
    triggeredBy?: string | null;
  }): Promise<CommercialReadinessEvaluation> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_commercial_readiness_evaluations (
         id, offer_type, offer_id, product_id, result, checks, blockers, warnings, triggered_by
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)
       RETURNING *`,
      [
        id,
        input.offerType,
        input.offerId,
        input.productId,
        input.result,
        JSON.stringify(input.checks),
        JSON.stringify(input.blockers),
        JSON.stringify(input.warnings),
        input.triggeredBy ?? null,
      ],
    );
    const row = result.rows[0];
    return {
      id: row.id as string,
      offerType: row.offer_type as string,
      offerId: row.offer_id as string,
      productId: row.product_id as string,
      result: row.result as CommercialReadinessResult,
      checks: row.checks as unknown[],
      blockers: row.blockers as unknown[],
      warnings: row.warnings as unknown[],
      createdAt: row.created_at as Date,
    };
  }

  async createPublicationSnapshot(input: {
    offerType: string;
    offerId: string;
    productId: string;
    snapshot: Record<string, unknown>;
    readinessEvaluationId?: string | null;
    publishedBy?: string | null;
  }): Promise<{ id: string; publishedAt: Date }> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_commercial_publication_snapshots (
         id, offer_type, offer_id, product_id, snapshot,
         readiness_evaluation_id, published_by
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
       RETURNING id, published_at`,
      [
        id,
        input.offerType,
        input.offerId,
        input.productId,
        JSON.stringify(input.snapshot),
        input.readinessEvaluationId ?? null,
        input.publishedBy ?? null,
      ],
    );
    return {
      id: result.rows[0].id as string,
      publishedAt: result.rows[0].published_at as Date,
    };
  }

  private mapMarket(row: Record<string, unknown>): CommercialMarket {
    return {
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      verticalId: row.vertical_id as string,
      geographicScope: (row.geographic_scope as string | null) ?? null,
      marketStatus: row.market_status as string,
      researchStatus: row.research_status as string,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapIcp(row: Record<string, unknown>): IcpDefinition {
    return {
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      verticalId: row.vertical_id as string,
      productId: row.product_id as string,
      status: row.status as string,
      version: Number(row.version),
      attributes: (row.attributes as Record<string, unknown>) ?? {},
      scoring: (row.scoring as Record<string, unknown>) ?? {},
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapPackage(row: Record<string, unknown>): SolutionPackage {
    return {
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      productId: row.product_id as string,
      verticalId: row.vertical_id as string,
      status: row.status as string,
      version: Number(row.version),
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapPlan(row: Record<string, unknown>): CommercialPlan {
    return {
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      productId: row.product_id as string,
      verticalId: row.vertical_id as string,
      planTier: row.plan_tier as PlanTier,
      solutionPackageId: (row.solution_package_id as string | null) ?? null,
      status: row.status as string,
      version: Number(row.version),
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapAddon(row: Record<string, unknown>): CommercialAddon {
    return {
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      productId: row.product_id as string,
      addonType: row.addon_type as string,
      status: row.status as string,
      version: Number(row.version),
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapPriceBook(row: Record<string, unknown>): PriceBook {
    return {
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      productId: row.product_id as string,
      currency: row.currency as string,
      geographicScope: (row.geographic_scope as string | null) ?? null,
      status: row.status as string,
      version: Number(row.version),
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapPriceEntry(row: Record<string, unknown>): PriceBookEntry {
    return {
      id: row.id as string,
      priceBookId: row.price_book_id as string,
      commercialItemType: row.commercial_item_type as string,
      commercialItemId: row.commercial_item_id as string,
      currency: row.currency as string,
      amount: String(row.amount),
      billingFrequency: (row.billing_frequency as string | null) ?? null,
    };
  }

  async createPersona(input: {
    code: string;
    name: string;
    roleLabel: string;
    verticalId?: string | null;
    productId?: string | null;
    attributes?: Record<string, unknown>;
    influenceLevel?: string | null;
    decisionAuthority?: string | null;
  }): Promise<{
    id: string;
    code: string;
    name: string;
    roleLabel: string;
    status: string;
  }> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_persona_definitions (
         id, code, name, role_label, vertical_id, product_id,
         attributes, influence_level, decision_authority
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
       RETURNING id, code, name, role_label, status`,
      [
        id,
        input.code,
        input.name,
        input.roleLabel,
        input.verticalId ?? null,
        input.productId ?? null,
        JSON.stringify(input.attributes ?? {}),
        input.influenceLevel ?? null,
        input.decisionAuthority ?? null,
      ],
    );
    return {
      id: result.rows[0].id as string,
      code: result.rows[0].code as string,
      name: result.rows[0].name as string,
      roleLabel: result.rows[0].role_label as string,
      status: result.rows[0].status as string,
    };
  }

  async listPersonas(productId?: string): Promise<
    readonly {
      id: string;
      code: string;
      name: string;
      roleLabel: string;
      status: string;
      productId: string | null;
      verticalId: string | null;
    }[]
  > {
    const result = productId
      ? await this.pool.query(
          `SELECT id, code, name, role_label, status, product_id, vertical_id
           FROM edge_persona_definitions WHERE product_id = $1 ORDER BY code`,
          [productId],
        )
      : await this.pool.query(
          `SELECT id, code, name, role_label, status, product_id, vertical_id
           FROM edge_persona_definitions ORDER BY code`,
        );
    return result.rows.map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      roleLabel: r.role_label as string,
      status: r.status as string,
      productId: (r.product_id as string | null) ?? null,
      verticalId: (r.vertical_id as string | null) ?? null,
    }));
  }

  async createValueProposition(input: {
    code: string;
    name: string;
    productId: string;
    verticalId: string;
    segmentId?: string | null;
    icpId?: string | null;
    targetAudience?: string | null;
    customerProblem?: string | null;
    proposedSolution?: string | null;
    expectedOutcome?: string | null;
    differentiation?: string | null;
    positioningStatement?: string | null;
    evidence?: readonly unknown[];
    limitations?: string | null;
  }): Promise<{
    id: string;
    code: string;
    name: string;
    productId: string;
    status: string;
    validationStatus: string;
  }> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_value_propositions (
         id, code, name, product_id, vertical_id, segment_id, icp_id,
         target_audience, customer_problem, proposed_solution, expected_outcome,
         differentiation, positioning_statement, evidence, limitations
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)
       RETURNING id, code, name, product_id, status, validation_status`,
      [
        id,
        input.code,
        input.name,
        input.productId,
        input.verticalId,
        input.segmentId ?? null,
        input.icpId ?? null,
        input.targetAudience ?? null,
        input.customerProblem ?? null,
        input.proposedSolution ?? null,
        input.expectedOutcome ?? null,
        input.differentiation ?? null,
        input.positioningStatement ?? null,
        JSON.stringify(input.evidence ?? []),
        input.limitations ?? null,
      ],
    );
    return {
      id: result.rows[0].id as string,
      code: result.rows[0].code as string,
      name: result.rows[0].name as string,
      productId: result.rows[0].product_id as string,
      status: result.rows[0].status as string,
      validationStatus: result.rows[0].validation_status as string,
    };
  }

  async listValuePropositions(productId?: string): Promise<
    readonly {
      id: string;
      code: string;
      name: string;
      productId: string;
      status: string;
      validationStatus: string;
    }[]
  > {
    const result = productId
      ? await this.pool.query(
          `SELECT id, code, name, product_id, status, validation_status
           FROM edge_value_propositions WHERE product_id = $1 ORDER BY code`,
          [productId],
        )
      : await this.pool.query(
          `SELECT id, code, name, product_id, status, validation_status
           FROM edge_value_propositions ORDER BY code`,
        );
    return result.rows.map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      productId: r.product_id as string,
      status: r.status as string,
      validationStatus: r.validation_status as string,
    }));
  }

  async createDiscountPolicy(input: {
    code: string;
    name: string;
    productId?: string | null;
    discountType: string;
    maxPercentage?: string | null;
    maxAmount?: string | null;
    approvalMatrix?: readonly unknown[];
  }): Promise<{
    id: string;
    code: string;
    name: string;
    discountType: string;
    status: string;
  }> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_discount_policies (
         id, code, name, product_id, discount_type,
         max_percentage, max_amount, approval_matrix
       ) VALUES ($1,$2,$3,$4,$5,$6::numeric,$7::numeric,$8::jsonb)
       RETURNING id, code, name, discount_type, status`,
      [
        id,
        input.code,
        input.name,
        input.productId ?? null,
        input.discountType,
        input.maxPercentage ?? null,
        input.maxAmount ?? null,
        JSON.stringify(input.approvalMatrix ?? []),
      ],
    );
    return {
      id: result.rows[0].id as string,
      code: result.rows[0].code as string,
      name: result.rows[0].name as string,
      discountType: result.rows[0].discount_type as string,
      status: result.rows[0].status as string,
    };
  }

  async listDiscountPolicies(productId?: string): Promise<
    readonly {
      id: string;
      code: string;
      name: string;
      discountType: string;
      status: string;
      maxPercentage: string | null;
      maxAmount: string | null;
    }[]
  > {
    const result = productId
      ? await this.pool.query(
          `SELECT id, code, name, discount_type, status, max_percentage, max_amount
           FROM edge_discount_policies
           WHERE product_id = $1 OR product_id IS NULL
           ORDER BY code`,
          [productId],
        )
      : await this.pool.query(
          `SELECT id, code, name, discount_type, status, max_percentage, max_amount
           FROM edge_discount_policies ORDER BY code`,
        );
    return result.rows.map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      discountType: r.discount_type as string,
      status: r.status as string,
      maxPercentage: r.max_percentage != null ? String(r.max_percentage) : null,
      maxAmount: r.max_amount != null ? String(r.max_amount) : null,
    }));
  }

  async createResearchProject(input: {
    marketId: string;
    code: string;
    title: string;
    researchQuestion?: string | null;
    hypothesis?: string | null;
    methodology?: string | null;
    ownerRef?: string | null;
    geographicScope?: string | null;
  }) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_market_research_projects (
         id, market_id, code, title, research_question, hypothesis, methodology,
         owner_ref, geographic_scope
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, code, title, status, market_id`,
      [
        id,
        input.marketId,
        input.code,
        input.title,
        input.researchQuestion ?? null,
        input.hypothesis ?? null,
        input.methodology ?? null,
        input.ownerRef ?? null,
        input.geographicScope ?? null,
      ],
    );
    return {
      id: result.rows[0].id as string,
      code: result.rows[0].code as string,
      title: result.rows[0].title as string,
      status: result.rows[0].status as string,
      marketId: result.rows[0].market_id as string,
    };
  }

  async listResearchProjects(marketId?: string) {
    const result = marketId
      ? await this.pool.query(
          `SELECT id, code, title, status, market_id FROM edge_market_research_projects
           WHERE market_id = $1 ORDER BY code`,
          [marketId],
        )
      : await this.pool.query(
          `SELECT id, code, title, status, market_id FROM edge_market_research_projects ORDER BY code`,
        );
    return result.rows.map((r) => ({
      id: r.id as string,
      code: r.code as string,
      title: r.title as string,
      status: r.status as string,
      marketId: r.market_id as string,
    }));
  }

  async addResearchSource(input: {
    projectId: string;
    sourceType: string;
    title: string;
    uri?: string | null;
    reliability?: string | null;
    confidence?: string | null;
    notes?: string | null;
  }) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_market_research_sources (
         id, project_id, source_type, title, uri, reliability, confidence, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, project_id, title, source_type`,
      [
        id,
        input.projectId,
        input.sourceType,
        input.title,
        input.uri ?? null,
        input.reliability ?? null,
        input.confidence ?? null,
        input.notes ?? null,
      ],
    );
    return {
      id: result.rows[0].id as string,
      projectId: result.rows[0].project_id as string,
      title: result.rows[0].title as string,
      sourceType: result.rows[0].source_type as string,
    };
  }

  async completeResearchProject(input: {
    projectId: string;
    findings?: string | null;
    conclusions?: string | null;
    limitations?: string | null;
    confidenceLevel?: string | null;
  }) {
    const result = await this.pool.query(
      `UPDATE edge_market_research_projects
       SET status = 'COMPLETED',
           findings = COALESCE($2, findings),
           conclusions = COALESCE($3, conclusions),
           limitations = COALESCE($4, limitations),
           confidence_level = COALESCE($5, confidence_level),
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, status`,
      [
        input.projectId,
        input.findings ?? null,
        input.conclusions ?? null,
        input.limitations ?? null,
        input.confidenceLevel ?? null,
      ],
    );
    if (!result.rows[0]) {
      throw new Error('Research project not found');
    }
    return {
      id: result.rows[0].id as string,
      status: result.rows[0].status as string,
    };
  }

  async upsertSegmentIntelligence(input: {
    segmentId: string;
    commercialDescription?: string | null;
    lifecycleStatus?: string;
    attractivenessScore?: string | null;
    strategicFitScore?: string | null;
    productReadinessScore?: string | null;
    overallPriorityScore?: string | null;
    researchConfidence?: string;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const result = await this.pool.query(
      `INSERT INTO edge_segment_intelligence (
         id, segment_id, commercial_description, lifecycle_status,
         attractiveness_score, strategic_fit_score, product_readiness_score,
         overall_priority_score, research_confidence, notes, metadata
       ) VALUES ($1,$2,$3,$4,$5::numeric,$6::numeric,$7::numeric,$8::numeric,$9,$10,$11::jsonb)
       ON CONFLICT (segment_id) DO UPDATE SET
         commercial_description = COALESCE(EXCLUDED.commercial_description, edge_segment_intelligence.commercial_description),
         lifecycle_status = COALESCE(EXCLUDED.lifecycle_status, edge_segment_intelligence.lifecycle_status),
         attractiveness_score = COALESCE(EXCLUDED.attractiveness_score, edge_segment_intelligence.attractiveness_score),
         strategic_fit_score = COALESCE(EXCLUDED.strategic_fit_score, edge_segment_intelligence.strategic_fit_score),
         product_readiness_score = COALESCE(EXCLUDED.product_readiness_score, edge_segment_intelligence.product_readiness_score),
         overall_priority_score = COALESCE(EXCLUDED.overall_priority_score, edge_segment_intelligence.overall_priority_score),
         research_confidence = COALESCE(EXCLUDED.research_confidence, edge_segment_intelligence.research_confidence),
         notes = COALESCE(EXCLUDED.notes, edge_segment_intelligence.notes),
         metadata = CASE
           WHEN EXCLUDED.metadata = '{}'::jsonb THEN edge_segment_intelligence.metadata
           ELSE EXCLUDED.metadata
         END,
         updated_at = NOW()
       RETURNING id, segment_id, lifecycle_status, research_confidence`,
      [
        randomUUID(),
        input.segmentId,
        input.commercialDescription ?? null,
        input.lifecycleStatus ?? 'DISCOVERY',
        input.attractivenessScore ?? null,
        input.strategicFitScore ?? null,
        input.productReadinessScore ?? null,
        input.overallPriorityScore ?? null,
        input.researchConfidence ?? 'NEEDS_RESEARCH',
        input.notes ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return {
      id: result.rows[0].id as string,
      segmentId: result.rows[0].segment_id as string,
      lifecycleStatus: result.rows[0].lifecycle_status as string,
      researchConfidence: result.rows[0].research_confidence as string,
    };
  }

  async listSegmentIntelligence(segmentId?: string) {
    const result = segmentId
      ? await this.pool.query(
          `SELECT id, segment_id, lifecycle_status, research_confidence, overall_priority_score
           FROM edge_segment_intelligence WHERE segment_id = $1`,
          [segmentId],
        )
      : await this.pool.query(
          `SELECT id, segment_id, lifecycle_status, research_confidence, overall_priority_score
           FROM edge_segment_intelligence ORDER BY updated_at DESC`,
        );
    return result.rows.map((r) => ({
      id: r.id as string,
      segmentId: r.segment_id as string,
      lifecycleStatus: r.lifecycle_status as string,
      researchConfidence: r.research_confidence as string,
      overallPriorityScore:
        r.overall_priority_score != null ? String(r.overall_priority_score) : null,
    }));
  }

  async getSegmentPriorityModel(code = 'DEFAULT_SEGMENT_PRIORITY') {
    const result = await this.pool.query(
      `SELECT id, code, weights, version FROM edge_segment_priority_models
       WHERE code = $1 AND status = 'ACTIVE'`,
      [code],
    );
    if (!result.rows[0]) return null;
    return {
      id: result.rows[0].id as string,
      code: result.rows[0].code as string,
      weights: result.rows[0].weights as Record<string, number>,
      version: Number(result.rows[0].version),
    };
  }

  async createPricingModel(input: {
    code: string;
    name: string;
    modelType: string;
    productId: string;
    pricingUnitId?: string | null;
    components?: Record<string, unknown>;
    currency?: string | null;
  }) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_pricing_models (
         id, code, name, model_type, product_id, pricing_unit_id, components, currency
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
       RETURNING id, code, model_type, product_id`,
      [
        id,
        input.code,
        input.name,
        input.modelType,
        input.productId,
        input.pricingUnitId ?? null,
        JSON.stringify(input.components ?? {}),
        input.currency ?? null,
      ],
    );
    return {
      id: result.rows[0].id as string,
      code: result.rows[0].code as string,
      modelType: result.rows[0].model_type as string,
      productId: result.rows[0].product_id as string,
    };
  }

  async listPricingModels(productId?: string) {
    const result = productId
      ? await this.pool.query(
          `SELECT id, code, name, model_type, product_id FROM edge_pricing_models
           WHERE product_id = $1 ORDER BY code`,
          [productId],
        )
      : await this.pool.query(
          `SELECT id, code, name, model_type, product_id FROM edge_pricing_models ORDER BY code`,
        );
    return result.rows.map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      modelType: r.model_type as string,
      productId: r.product_id as string,
    }));
  }

  async createUsageMetric(input: {
    code: string;
    name: string;
    description?: string | null;
    pricingUnitId?: string | null;
    sourceEvent?: string | null;
    aggregationWindow?: string | null;
    aggregationMethod?: string | null;
    deduplicationRequired?: boolean;
  }) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_usage_metric_definitions (
         id, code, name, description, pricing_unit_id, source_event,
         aggregation_window, aggregation_method, deduplication_required
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, code, name`,
      [
        id,
        input.code,
        input.name,
        input.description ?? null,
        input.pricingUnitId ?? null,
        input.sourceEvent ?? null,
        input.aggregationWindow ?? null,
        input.aggregationMethod ?? null,
        input.deduplicationRequired ?? false,
      ],
    );
    return {
      id: result.rows[0].id as string,
      code: result.rows[0].code as string,
      name: result.rows[0].name as string,
    };
  }

  async listUsageMetrics() {
    const result = await this.pool.query(
      `SELECT id, code, name, status FROM edge_usage_metric_definitions ORDER BY code`,
    );
    return result.rows.map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      status: r.status as string,
    }));
  }

  async createBuyingCommittee(input: {
    code: string;
    name: string;
    productId?: string | null;
    verticalId?: string | null;
    segmentId?: string | null;
    roles?: readonly unknown[];
  }) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_buying_committee_models (
         id, code, name, product_id, vertical_id, segment_id, roles
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING id, code, name`,
      [
        id,
        input.code,
        input.name,
        input.productId ?? null,
        input.verticalId ?? null,
        input.segmentId ?? null,
        JSON.stringify(input.roles ?? []),
      ],
    );
    return {
      id: result.rows[0].id as string,
      code: result.rows[0].code as string,
      name: result.rows[0].name as string,
    };
  }

  async listBuyingCommittees(productId?: string) {
    const result = productId
      ? await this.pool.query(
          `SELECT id, code, name, status FROM edge_buying_committee_models
           WHERE product_id = $1 ORDER BY code`,
          [productId],
        )
      : await this.pool.query(
          `SELECT id, code, name, status FROM edge_buying_committee_models ORDER BY code`,
        );
    return result.rows.map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      status: r.status as string,
    }));
  }

  async createDecisionJourney(input: {
    code: string;
    name: string;
    productId?: string | null;
    verticalId?: string | null;
    stages?: readonly unknown[];
  }) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_decision_journey_models (
         id, code, name, product_id, vertical_id, stages
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       RETURNING id, code, name`,
      [
        id,
        input.code,
        input.name,
        input.productId ?? null,
        input.verticalId ?? null,
        JSON.stringify(input.stages ?? []),
      ],
    );
    return {
      id: result.rows[0].id as string,
      code: result.rows[0].code as string,
      name: result.rows[0].name as string,
    };
  }

  async listDecisionJourneys(productId?: string) {
    const result = productId
      ? await this.pool.query(
          `SELECT id, code, name, status FROM edge_decision_journey_models
           WHERE product_id = $1 ORDER BY code`,
          [productId],
        )
      : await this.pool.query(
          `SELECT id, code, name, status FROM edge_decision_journey_models ORDER BY code`,
        );
    return result.rows.map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      status: r.status as string,
    }));
  }

  async createEnterpriseTemplate(input: {
    code: string;
    name: string;
    description?: string | null;
    productId: string;
    verticalId: string;
    solutionPackageId?: string | null;
    basePlanId?: string | null;
    deploymentProfile?: Record<string, unknown>;
    supportProfile?: Record<string, unknown>;
    slaProfile?: Record<string, unknown>;
    negotiableTerms?: readonly unknown[];
    nonNegotiableTerms?: readonly unknown[];
    approvalLevelRequired?: string | null;
    createdBy?: string | null;
  }) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_enterprise_offer_templates (
         id, code, name, description, product_id, vertical_id,
         solution_package_id, base_plan_id, deployment_profile, support_profile,
         sla_profile, negotiable_terms, non_negotiable_terms,
         approval_level_required, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15)
       RETURNING id, code, name, status, version`,
      [
        id,
        input.code,
        input.name,
        input.description ?? null,
        input.productId,
        input.verticalId,
        input.solutionPackageId ?? null,
        input.basePlanId ?? null,
        JSON.stringify(input.deploymentProfile ?? {}),
        JSON.stringify(input.supportProfile ?? {}),
        JSON.stringify(input.slaProfile ?? {}),
        JSON.stringify(input.negotiableTerms ?? []),
        JSON.stringify(input.nonNegotiableTerms ?? []),
        input.approvalLevelRequired ?? null,
        input.createdBy ?? null,
      ],
    );
    return {
      id: result.rows[0].id as string,
      code: result.rows[0].code as string,
      name: result.rows[0].name as string,
      status: result.rows[0].status as string,
      version: Number(result.rows[0].version),
    };
  }

  async listEnterpriseTemplates(productId?: string) {
    const result = productId
      ? await this.pool.query(
          `SELECT id, code, name, status, product_id, vertical_id FROM edge_enterprise_offer_templates
           WHERE product_id = $1 ORDER BY code`,
          [productId],
        )
      : await this.pool.query(
          `SELECT id, code, name, status, product_id, vertical_id FROM edge_enterprise_offer_templates ORDER BY code`,
        );
    return result.rows.map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      status: r.status as string,
      productId: r.product_id as string,
      verticalId: r.vertical_id as string,
    }));
  }

  async getEnterpriseTemplate(id: string) {
    const result = await this.pool.query(
      `SELECT id, code, name, status, product_id, vertical_id, version,
              deployment_profile, base_plan_id, solution_package_id
       FROM edge_enterprise_offer_templates WHERE id = $1`,
      [id],
    );
    const r = result.rows[0];
    if (!r) return null;
    return {
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      status: r.status as string,
      productId: r.product_id as string,
      verticalId: r.vertical_id as string,
      version: Number(r.version),
      deploymentProfile: (r.deployment_profile as Record<string, unknown>) ?? {},
      basePlanId: (r.base_plan_id as string | null) ?? null,
      solutionPackageId: (r.solution_package_id as string | null) ?? null,
    };
  }

  async updateEnterpriseTemplateStatus(id: string, status: string) {
    const result = await this.pool.query(
      `UPDATE edge_enterprise_offer_templates
       SET status = $2, updated_at = NOW(), version = version + 1
       WHERE id = $1
       RETURNING id, code, name, status, product_id, version`,
      [id, status],
    );
    const r = result.rows[0];
    return {
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      status: r.status as string,
      productId: r.product_id as string,
      version: Number(r.version),
    };
  }

  async updateAddonStatus(id: string, status: string): Promise<CommercialAddon> {
    const result = await this.pool.query(
      `UPDATE edge_commercial_addons
       SET status = $2, updated_at = NOW(), version = version + 1
       WHERE id = $1
       RETURNING *`,
      [id, status],
    );
    return this.mapAddon(result.rows[0]);
  }

  async createEligibilityPolicy(input: {
    code: string;
    name: string;
    productId?: string | null;
    offerType?: string;
    offerId?: string | null;
    rules?: Record<string, unknown>;
  }) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_eligibility_policies (
         id, code, name, product_id, offer_type, offer_id, rules
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING id, code, name, version`,
      [
        id,
        input.code,
        input.name,
        input.productId ?? null,
        input.offerType ?? 'PLAN',
        input.offerId ?? null,
        JSON.stringify(input.rules ?? {}),
      ],
    );
    return {
      id: result.rows[0].id as string,
      code: result.rows[0].code as string,
      name: result.rows[0].name as string,
      version: Number(result.rows[0].version),
    };
  }

  async listEligibilityPolicies(productId?: string) {
    const result = productId
      ? await this.pool.query(
          `SELECT id, code, name, offer_type, version FROM edge_eligibility_policies
           WHERE product_id = $1 OR product_id IS NULL ORDER BY code`,
          [productId],
        )
      : await this.pool.query(
          `SELECT id, code, name, offer_type, version FROM edge_eligibility_policies ORDER BY code`,
        );
    return result.rows.map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      offerType: r.offer_type as string,
      version: Number(r.version),
    }));
  }

  async getEligibilityPolicy(id: string) {
    const result = await this.pool.query(
      `SELECT id, code, rules, version, product_id FROM edge_eligibility_policies WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) return null;
    return {
      id: result.rows[0].id as string,
      code: result.rows[0].code as string,
      rules: result.rows[0].rules as Record<string, unknown>,
      version: Number(result.rows[0].version),
      productId: (result.rows[0].product_id as string | null) ?? null,
    };
  }

  async addMarketAssessment(input: {
    marketId: string;
    dimension: string;
    valueText?: string | null;
    valueNumeric?: string | null;
    unknown?: boolean;
    sourceRef?: string | null;
    confidence?: string | null;
  }) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO edge_market_assessments (
         id, market_id, dimension, value_text, value_numeric, unknown, source_ref, confidence
       ) VALUES ($1,$2,$3,$4,$5::numeric,$6,$7,$8)
       RETURNING id, market_id, dimension, unknown`,
      [
        id,
        input.marketId,
        input.dimension,
        input.valueText ?? null,
        input.valueNumeric ?? null,
        input.unknown ?? true,
        input.sourceRef ?? null,
        input.confidence ?? null,
      ],
    );
    return {
      id: result.rows[0].id as string,
      marketId: result.rows[0].market_id as string,
      dimension: result.rows[0].dimension as string,
      unknown: Boolean(result.rows[0].unknown),
    };
  }

  async updatePackageStatus(id: string, status: string): Promise<SolutionPackage> {
    const result = await this.pool.query(
      `UPDATE edge_solution_packages
       SET status = $2, updated_at = NOW(), version = version + 1
       WHERE id = $1
       RETURNING *`,
      [id, status],
    );
    return this.mapPackage(result.rows[0]);
  }

  async updatePriceBookStatus(id: string, status: string): Promise<PriceBook> {
    const result = await this.pool.query(
      `UPDATE edge_price_books
       SET status = $2, updated_at = NOW(), version = version + 1
       WHERE id = $1
       RETURNING *`,
      [id, status],
    );
    return this.mapPriceBook(result.rows[0]);
  }

  async listPublicationSnapshots(input?: {
    offerType?: string;
    offerId?: string;
    productId?: string;
  }): Promise<
    readonly {
      id: string;
      offerType: string;
      offerId: string;
      productId: string;
      publishedAt: Date;
      publishedBy: string | null;
    }[]
  > {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (input?.offerType) {
      params.push(input.offerType);
      clauses.push(`offer_type = $${params.length}`);
    }
    if (input?.offerId) {
      params.push(input.offerId);
      clauses.push(`offer_id = $${params.length}`);
    }
    if (input?.productId) {
      params.push(input.productId);
      clauses.push(`product_id = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT id, offer_type, offer_id, product_id, published_at, published_by
       FROM edge_commercial_publication_snapshots
       ${where}
       ORDER BY published_at DESC
       LIMIT 100`,
      params,
    );
    return result.rows.map((r) => ({
      id: r.id as string,
      offerType: r.offer_type as string,
      offerId: r.offer_id as string,
      productId: r.product_id as string,
      publishedAt: r.published_at as Date,
      publishedBy: (r.published_by as string | null) ?? null,
    }));
  }

  async listMarketAssessments(marketId: string) {
    const result = await this.pool.query(
      `SELECT id, dimension, unknown, value_text, value_numeric, source_ref
       FROM edge_market_assessments WHERE market_id = $1 ORDER BY assessed_at DESC`,
      [marketId],
    );
    return result.rows.map((r) => ({
      id: r.id as string,
      dimension: r.dimension as string,
      unknown: Boolean(r.unknown),
      valueText: (r.value_text as string | null) ?? null,
      valueNumeric: r.value_numeric != null ? String(r.value_numeric) : null,
      sourceRef: (r.source_ref as string | null) ?? null,
    }));
  }
}
