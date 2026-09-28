import { DocumentBuilder, type OpenAPIObject } from '@nestjs/swagger';
import { SwaggerTags } from './swagger.constants.js';

const TAG_DESCRIPTIONS: Record<
  (typeof SwaggerTags)[keyof typeof SwaggerTags],
  string
> = {
  [SwaggerTags.HEALTH]:
    'Liveness, readiness, health summary, and Prometheus metrics (unversioned).',
  [SwaggerTags.PLATFORM]:
    'Authenticated workspace context, capabilities, organizations, and feature flags.',
  [SwaggerTags.TENANTS]:
    'Tenant profile, status, and ownership (tenant-scoped operators).',
  [SwaggerTags.ORGANIZATIONS]:
    'Organization CRUD and lifecycle within the active tenant.',
  [SwaggerTags.USERS]:
    'Application users directory, invites linkage, and lifecycle actions.',
  [SwaggerTags.MEMBERSHIPS]:
    'Organization membership grants, roles, and revocation.',
  [SwaggerTags.INVITATIONS]:
    'Invitation create, accept, revoke, and listing flows.',
  [SwaggerTags.ROLES]:
    'RBAC roles and permission catalog for the control plane.',
  [SwaggerTags.SETTINGS]:
    'Tenant and organization settings namespaces (branding, general, …).',
  [SwaggerTags.SECURITY]:
    'Security policies, sessions, delegations, and emergency access.',
  [SwaggerTags.ADMIN]:
    'Platform-admin tenant provisioning, domains, health, and reconciliation.',
  [SwaggerTags.CUSTOMERS]:
    'CRM customers, staff CRM, customer portal, and customer-auth (includes patient role).',
  [SwaggerTags.COMMERCE]:
    'Deprecated — commerce module removed.',
  [SwaggerTags.PHARMACY]:
    'Pharmacy engine: prescriptions, clinical safety, pharmacist verification, and dispensing (reuses Inventory/Sales/Insurance/Customer).',
  [SwaggerTags.CATALOG]:
    'Product catalog, SKUs, and barcodes.',
  [SwaggerTags.INVENTORY]:
    'Inventory ledger, lots, availability, reservation, and allocation.',
  [SwaggerTags.PRICING]:
    'Price lists, tax rules, and quote engine.',
  [SwaggerTags.SALES]:
    'Carts, quotations, and sales orders.',
  [SwaggerTags.FULFILLMENT]:
    'Picking and shipping.',
  [SwaggerTags.FINANCE]:
    'Commercial invoices and payments.',
  [SwaggerTags.RETURNS]:
    'Customer/supplier returns, quality decision, and restock/quarantine/dispose.',
  [SwaggerTags.PURCHASING]:
    'Suppliers, purchase requisitions/orders, goods receipt, and replenishment.',
  [SwaggerTags.POS]:
    'Point-of-sale checkout, offline sync, and Cash & Sales Session Engine (register/opening/cash ledger/closing/recon).',
  [SwaggerTags.COMMISSIONS]:
    'Sales agents, commission rules, periods, and accruals.',
  [SwaggerTags.CONTRACTS]:
    'Unified commercial contracts lifecycle (customer/supplier/agreements).',
  [SwaggerTags.LOYALTY]:
    'Loyalty tiers, accounts, points earn/redeem, and rewards (decoupled from sales).',
  [SwaggerTags.VOUCHERS]:
    'Gift voucher issue, activate, redeem, and cancel.',
  [SwaggerTags.WORKFLOW]:
    'Commercial approval workflows and decision tasks.',
  [SwaggerTags.POLICIES]:
    'Business rule policies (ORDER, pricing, credit, discount, approval, …).',
  [SwaggerTags.SEARCH]:
    'Global commercial search across orders, invoices, catalog, and related documents.',
  [SwaggerTags.COMMERCIAL_OPS]:
    'Bulk jobs and import pipeline (validate / preview / approve / import).',
  [SwaggerTags.REPORTS]:
    'Commercial sales reports by day, product, customer, and channel.',
  [SwaggerTags.DASHBOARDS]:
    'Dashboard projections for sales, inventory, purchasing, customer, and profitability.',
  [SwaggerTags.ANALYTICS]:
    'KPI catalog and computed commercial KPI snapshots.',
  [SwaggerTags.READ_MODELS]:
    'Commercial CQRS read-model projections (orders, availability, balances, fulfillment).',
  [SwaggerTags.COMMERCIAL_JOBS]:
    'Scheduled commercial jobs, reconciliation reports, and notification outbox.',
  [SwaggerTags.WEBHOOKS]:
    'Tenant commercial webhook configs and HMAC-signed delivery.',
  [SwaggerTags.COMMERCIAL_CONFIG]:
    'Commercial org configuration, availability policies, and priority rules.',
  [SwaggerTags.AI]:
    'AI readiness forecasts, recommendations, and insights (non-transactional; must not bypass engines).',
  [SwaggerTags.COPILOT]:
    'Commercial copilot query services composing sales, inventory, pricing, and finance reads.',
  [SwaggerTags.ORCHESTRATION]:
    'ERP orchestration: sagas, business process monitor, three-way match, POS shift close, ops interventions.',
  [SwaggerTags.BUSINESS_CONFIG]:
    'Business profiles, capability registry, entitlements, packs, and BusinessContext resolution.',
  [SwaggerTags.MCP]:
    'Model Context Protocol tool listing and invoke façade (authenticated, capability-gated).',
  [SwaggerTags.VERTICAL_OPS]:
    'Vertical engines still hosted here (Kitchen / Hotel PMS). Insurance moved to Insurance tag.',
  [SwaggerTags.INSURANCE]:
    'Healthcare insurance: policies, membership, eligibility, coverage, claims, adjudication, reconciliation.',
};

/**
 * Shared OpenAPI document definition for Swagger UI (`/docs`) and `pnpm docs:openapi`.
 */
export function createPlatformOpenApiConfig(serverUrl?: string) {
  const builder = new DocumentBuilder()
    .setTitle('Platform Core API')
    .setDescription(
      [
        'Enterprise multi-tenant SaaS API for identity, tenants, and CRM.',
        '',
        '## Authentication',
        'Protected routes require `Authorization: Bearer <Keycloak JWT>`.',
        'Tenant and organization context are derived from JWT claims only — never from client-supplied tenant headers.',
        '',
        '## Response envelope',
        'Success: `{ "data": ... }`',
        'Paginated: `{ "data": [...], "pagination": { page, limit, total, totalPages } }`',
        'Errors: `{ "error": { code, message, details, requestId, correlationId } }`',
        '',
        '## Versioning',
        'HTTP API routes use URI versioning under `/api/v1/...`.',
        'Health probes (`/liveness`, `/readiness`, `/health`, `/metrics`) are unversioned.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        description: 'Keycloak access token for platform / staff clients',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description:
          'Optional metrics gate: `Bearer <METRICS_AUTH_TOKEN>` when METRICS_AUTH_TOKEN is set',
      },
      'metrics',
    );

  for (const [name, description] of Object.entries(TAG_DESCRIPTIONS)) {
    builder.addTag(name, description);
  }

  if (serverUrl) {
    builder.addServer(serverUrl, 'API');
  }

  return builder.build();
}

/** Unique operationIds: ControllerClass_methodName */
export function uniqueOperationId(
  controllerKey: string,
  methodKey: string,
): string {
  const controller = controllerKey.replace(/Controller$/i, '') || 'Api';
  return `${controller}_${methodKey}`;
}

export type PlatformOpenApiDocument = OpenAPIObject;
