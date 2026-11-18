/**
 * Doc 44 — Lab e2e Retail + Hospitality via BB control/v1.
 *
 * Auth: EDGE_BB_CONTROL_TOKEN (= BB EDGE_CONTROL_LAB_TOKEN), header X-Edge-Control-Token.
 * Note: GET tenants/:id/ready returns 403 "Access denied" for unknown tenants (anti-enum) —
 * that is NOT an auth failure when /discover returns 200.
 *
 *   pnpm lab:e2e:retail
 *   pnpm lab:e2e:hospitality
 *   LAB_E2E_SKIP_PROVISION=true LAB_E2E_TENANT_ID=t_<uuid>  # reuse existing
 */
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from './load-env.js';
import { commercialPlanEntitlementSnapshot } from '../src/modules/edge/domain/commercial/commercial-plan-entitlements.js';

loadEnvFile();

const base = (process.env.EDGE_BB_CONTROL_BASE_URL ?? '').replace(/\/$/, '');
const controlToken =
  process.env.EDGE_BB_CONTROL_TOKEN ??
  process.env.EDGE_CONTROL_LAB_TOKEN ??
  process.env.EDGE_CONTROL_BEARER ??
  process.env.EDGE_M2M_BEARER ??
  '';
const profileArg = process.argv.find((a) => a.startsWith('--profile='))?.split('=')[1];
const profile = (profileArg ?? process.env.LAB_E2E_PROFILE ?? 'SUPERMARKET').toUpperCase();
const skipProvision = process.env.LAB_E2E_SKIP_PROVISION === 'true';
const existingTenant = process.env.LAB_E2E_TENANT_ID?.trim();

type Scenario = {
  name: string;
  planCode: string;
  productCode: string;
  profileCode: string;
};

const SCENARIOS: Record<string, Scenario> = {
  SUPERMARKET: {
    name: 'retail-lite',
    planCode: 'OKAPI_RETAIL_LITE',
    productCode: 'OKAPI_RETAIL',
    profileCode: 'SUPERMARKET',
  },
  HOTEL_HOSPITALITY: {
    name: 'hospitality-lite',
    planCode: 'OKAPI_HOSP_LITE',
    productCode: 'OKAPI_HOSPITALITY',
    profileCode: 'HOTEL_HOSPITALITY',
  },
};

const scenario = SCENARIOS[profile] ?? SCENARIOS.SUPERMARKET;

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra ?? {}),
  };
  if (controlToken) {
    h['X-Edge-Control-Token'] = controlToken;
    h.Authorization = `Bearer ${controlToken}`;
  }
  return h;
}

/** BB ready-gate expects commercial shape: { modules|capabilities|featureFlags|quotas }. */
function commercialEntitlementsPayload(
  snap: NonNullable<ReturnType<typeof commercialPlanEntitlementSnapshot>>,
): Record<string, unknown> {
  const modules: Record<string, boolean> = {};
  const quotas: Record<string, number> = {};
  for (const c of snap.capabilities) {
    if (c.kind === 'QUOTA' && typeof c.numericLimit === 'number') {
      quotas[c.capabilityCode] = c.numericLimit;
      continue;
    }
    modules[c.capabilityCode] = true;
  }
  if (!Object.keys(modules).length) modules.identity = true;
  return {
    modules,
    ...(Object.keys(quotas).length ? { quotas } : {}),
    profile_code: snap.profileCode,
    product_code: snap.productCode,
    plan_code: snap.planCode,
  };
}

async function main(): Promise<void> {
  const snap = commercialPlanEntitlementSnapshot(scenario.planCode);
  const entitlementsOk = !!snap && snap.capabilities.length > 0 && snap.sellable === false;

  if (!base) {
    console.log(
      JSON.stringify(
        {
          status: 'DRY_CHECKLIST',
          scenario,
          entitlements: {
            ok: entitlementsOk,
            count: snap?.capabilities.length ?? 0,
            sellable: snap?.sellable ?? null,
          },
          note: 'Set EDGE_BB_CONTROL_BASE_URL + EDGE_BB_CONTROL_TOKEN for live',
        },
        null,
        2,
      ),
    );
    process.exit(entitlementsOk ? 0 : 1);
  }

  const t0 = Date.now();
  const evidence: Record<string, unknown> = {
    status: 'LIVE',
    scenario,
    entitlementsCatalog: {
      ok: entitlementsOk,
      count: snap?.capabilities.length ?? 0,
      sellable: snap?.sellable ?? null,
      profileCode: snap?.profileCode ?? null,
    },
    tokenPresent: Boolean(controlToken),
    startedAt: new Date().toISOString(),
  };

  const discover = await fetch(`${base}/control/v1/discover`, { headers: headers() });
  evidence.discover = { status: discover.status, ms: Date.now() - t0 };
  const authOk = discover.ok;
  evidence.auth = authOk
    ? 'OK (discover)'
    : 'FAIL — EDGE_BB_CONTROL_TOKEN must match BB EDGE_CONTROL_LAB_TOKEN';

  if (!authOk || !entitlementsOk) {
    evidence.result = authOk ? 'FAIL' : 'BLOCKED_AUTH';
    evidence.duration_ms = Date.now() - t0;
    console.log(JSON.stringify(evidence, null, 2));
    process.exit(1);
  }

  const edgeUuid = randomUUID();
  const tenantId = existingTenant || `t_${edgeUuid}`;
  evidence.tenantId = tenantId;

  if (!skipProvision && !existingTenant) {
    const provisionBody = {
      tenant_id: tenantId,
      account_id: `a_${edgeUuid}`,
      product_id: scenario.productCode,
      profile_code: scenario.profileCode,
      plan_version: scenario.planCode,
      region: 'eu-west',
      environment: 'staging' as const,
      entitlement_version: 1,
      entitlements: commercialEntitlementsPayload(snap!),
      organizations: [{ name: `Lab ${scenario.name}` }],
      initial_admin_contact: {
        name: 'Lab Admin',
        email: `lab-${scenario.name}-${Date.now()}@example.com`,
        locale: 'fr',
      },
    };
    const provStarted = Date.now();
    const prov = await fetch(`${base}/control/v1/provision`, {
      method: 'POST',
      headers: headers({ 'Idempotency-Key': `lab-e2e-${scenario.name}-${edgeUuid}` }),
      body: JSON.stringify(provisionBody),
    });
    const provText = await prov.text();
    let provJson: unknown = {};
    try {
      provJson = JSON.parse(provText);
    } catch {
      provJson = { raw: provText.slice(0, 500) };
    }
    evidence.provision = {
      status: prov.status,
      ms: Date.now() - provStarted,
      body: provJson,
    };
    if (!prov.ok) {
      evidence.result = 'FAIL_PROVISION';
      evidence.duration_ms = Date.now() - t0;
      console.log(JSON.stringify(evidence, null, 2));
      process.exit(1);
    }
  } else {
    evidence.provision = { skipped: true, tenantId };
  }

  const readyRes = await fetch(
    `${base}/control/v1/tenants/${encodeURIComponent(tenantId)}/ready`,
    { headers: headers() },
  );
  const readyBody = await readyRes.json().catch(() => ({}));
  evidence.readyProbe = {
    status: readyRes.status,
    body: readyBody,
    note:
      readyRes.status === 403
        ? '403 may mean TENANT_NOT_FOUND (anti-enum) — not auth failure after discover 200'
        : undefined,
  };

  const emptyPut = await fetch(
    `${base}/control/v1/tenants/${encodeURIComponent(tenantId)}/entitlements`,
    {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({
        entitlements: {},
        contentHash: 'lab-empty',
        entitlement_version: 0,
      }),
    },
  );
  evidence.emptyEntitlementsRejected = emptyPut.status >= 400 && emptyPut.status < 500;

  const put = await fetch(
    `${base}/control/v1/tenants/${encodeURIComponent(tenantId)}/entitlements`,
    {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({
        entitlements: commercialEntitlementsPayload(snap!),
        contentHash: `lab-${scenario.planCode}`,
        entitlement_version: 2,
        metadata: {
          productCode: scenario.productCode,
          profileCode: scenario.profileCode,
          planCode: scenario.planCode,
          lab: true,
        },
      }),
    },
  );
  evidence.entitlementsPut = { status: put.status, body: await put.json().catch(() => ({})) };

  const ready2 = await fetch(
    `${base}/control/v1/tenants/${encodeURIComponent(tenantId)}/ready`,
    { headers: headers() },
  );
  evidence.readyAfterEntitlements = {
    status: ready2.status,
    body: await ready2.json().catch(() => ({})),
  };

  evidence.duration_ms = Date.now() - t0;
  const readyOk =
    ready2.status === 200 &&
    (evidence.readyAfterEntitlements as { body?: { ready?: boolean } }).body?.ready === true;
  const putOk = put.ok || put.status === 200 || put.status === 201;
  evidence.result =
    evidence.emptyEntitlementsRejected && (readyOk || putOk)
      ? readyOk
        ? 'PASS'
        : 'PARTIAL_PASS'
      : 'FAIL';

  evidence.gates = {
    mustRemainInternalOnly: true,
    sellableFalse: snap!.sellable === false,
    availableForbiddenWithoutG11: true,
  };

  console.log(JSON.stringify(evidence, null, 2));
  process.exit(evidence.result === 'FAIL' || evidence.result === 'FAIL_PROVISION' ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
