import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const edgeDomainRoot = join(process.cwd(), 'src/modules/edge/domain');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts') && !full.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

describe('Edge domain boundaries', () => {
  it('domain layer does not import NestJS, pg, or Keycloak SDKs', () => {
    const files = walk(edgeDomainRoot);
    expect(files.length).toBeGreaterThan(0);
    const forbidden = [
      /from '@nestjs\//,
      /from 'pg'/,
      /from 'ioredis'/,
      /keycloak-js/,
      /from '\.\.\/\.\.\/\.\.\/\.\.\/shared\/database\//,
    ];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const pattern of forbidden) {
        expect(src, `${file} matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('edge domain does not import identity tenant/org entities', () => {
    const files = walk(edgeDomainRoot);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/modules\/identity\/domain\/tenant/);
      expect(src).not.toMatch(/modules\/identity\/domain\/organization/);
      expect(src).not.toMatch(/application_users/);
    }
  });
});
