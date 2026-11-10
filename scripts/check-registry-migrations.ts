import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REQUIRED = ['096_edge_p7_product_platform_runtime_registry'] as const;

async function main(): Promise<void> {
  const file = resolve(
    process.cwd(),
    'migrations/control-plane/096_edge_p7_product_platform_runtime_registry.sql',
  );
  if (!existsSync(file)) {
    console.error('FAIL: missing migration file', file);
    process.exitCode = 1;
    return;
  }
  console.log('OK: registry migration file present');
  console.log('Required versions:', REQUIRED.join(', '));
  console.log(
    'Note: apply with npm run migrate:control then verify schema_migrations for 096_*',
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
