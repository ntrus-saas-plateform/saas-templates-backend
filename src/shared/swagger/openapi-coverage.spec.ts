import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (name.endsWith('.controller.ts')) acc.push(full);
  }
  return acc;
}

describe('OpenAPI coverage', () => {
  it('documents sessions and emergency-access (multi-controller files)', () => {
    const doc = JSON.parse(
      readFileSync(join(process.cwd(), 'docs/openapi.json'), 'utf8'),
    ) as { paths: Record<string, unknown>; tags?: unknown[] };
    expect(doc.paths['/api/v1/sessions']).toBeTruthy();
    expect(doc.paths['/api/v1/emergency-access']).toBeTruthy();
    expect((doc.tags ?? []).length).toBeGreaterThanOrEqual(14);
  });

  it('has a controller file for every registered HTTP module surface', () => {
    const files = walk(join(process.cwd(), 'src/modules'));
    expect(files.length).toBeGreaterThanOrEqual(21);
    const src = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const marker of [
      "@Controller('sessions')",
      "@Controller('emergency-access')",
      "@Controller('platform')",
      "@Controller('edge/workflows')",
      "@Controller('edge/registry')",
      "@Controller('edge/provisioning-requests')",
    ]) {
      expect(src).toContain(marker);
    }
  });
});
