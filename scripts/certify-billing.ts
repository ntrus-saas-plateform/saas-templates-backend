/**
 * Static P6 certification gate — filesystem + unit suite.
 * Does not claim staging readiness without migrate + live payment engine.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

const REQUIRED_FILES = [
  'migrations/control-plane/090_edge_billing_foundation.sql',
  'migrations/control-plane/091_edge_billing_invoicing_tax.sql',
  'migrations/control-plane/092_edge_billing_payments_ledger_collections.sql',
  'migrations/control-plane/093_edge_billing_ops_settlement_fx.sql',
  'migrations/control-plane/094_edge_billing_revenue_export_portal.sql',
  'src/modules/edge/presentation/controllers/billing.controller.ts',
  'src/modules/edge/infrastructure/persistence/pg-billing.repository.ts',
  'src/modules/edge/infrastructure/billing/billing-jobs.bootstrap.ts',
  'src/modules/edge/domain/billing/payment-provider.port.ts',
  'src/modules/edge/domain/billing/revenue-recognition.ts',
  'docs/edge/p6/18-certification-report.md',
  'docs/edge/p6/16-runbook-recovery.md',
  'docs/edge/p6/17-runbook-reconciliation.md',
] as const;

let failed = false;

console.log('P6 certify-billing — static gates\n');

for (const rel of REQUIRED_FILES) {
  const ok = existsSync(join(root, rel));
  console.log(`${ok ? '✓' : '✗'} ${rel}`);
  if (!ok) failed = true;
}

console.log('\nRunning unit suite test:edge:billing…');
const vitest = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vitest', 'run', 'src/modules/edge/domain/billing', 'src/modules/edge/infrastructure/billing'],
  { cwd: root, stdio: 'inherit', shell: true },
);
if (vitest.status !== 0) {
  failed = true;
  console.error('✗ unit suite failed');
} else {
  console.log('✓ unit suite passed');
}

console.log('\n---');
if (failed) {
  console.error('CERTIFY: FAIL (code incomplete or tests red)');
  console.error('Staging remains NO-GO until migrate 090–094 + payment engine + P0-H.');
  process.exit(1);
}

console.log('CERTIFY: CODE_COMPLETE');
console.log('Staging: NO-GO until migrate + live payment adapter + P0-H.');
process.exit(0);
