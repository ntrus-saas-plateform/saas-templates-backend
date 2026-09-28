/**
 * Export OpenAPI docs for Swagger consumers.
 *
 * Preference order:
 * 1. Live Nest `/docs-json` (exact parity with Swagger UI)
 * 2. Static AST export (`export-openapi-from-source.ts`) when API is down
 *
 * Usage: pnpm docs:openapi
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import './load-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outJson = join(root, 'edge-frontend/docs/openapi.json');
const outRootJson = join(root, 'docs/openapi.json');
const outMd = join(root, 'edge-frontend/docs/OPENAPI-SCHEMAS-REFERENCE.md');

const REQUIRED_PATHS = [
  '/api/v1/sessions',
  '/api/v1/emergency-access',
  '/api/v1/platform/me/capabilities',
  '/api/v1/users/me/identity',
  '/api/v1/users/me/identity/phone/send-otp',
  '/api/v1/users/me/preferences',
  '/api/v1/security/identity-providers',
  '/api/v1/customers',
  '/api/v1/admin/tenants',
];

async function fetchLiveDocs(): Promise<Record<string, unknown> | null> {
  const base =
    process.env.API_BASE_URL?.replace(/\/$/, '') ||
    process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') ||
    'http://localhost:3000';
  try {
    const res = await fetch(`${base}/docs-json`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function assertRequiredPaths(doc: Record<string, unknown>): void {
  const paths = (doc.paths ?? {}) as Record<string, unknown>;
  const missing = REQUIRED_PATHS.filter((p) => !paths[p]);
  if (missing.length) {
    throw new Error(`OpenAPI missing required paths: ${missing.join(', ')}`);
  }
}

function renderMarkdown(doc: Record<string, unknown>): string {
  const info = (doc.info ?? {}) as {
    title?: string;
    version?: string;
  };
  const paths = (doc.paths ?? {}) as Record<string, Record<string, unknown>>;
  const schemas = ((doc.components as { schemas?: Record<string, unknown> })
    ?.schemas ?? {}) as Record<string, unknown>;
  const tags = (doc.tags ?? []) as Array<{ name: string; description?: string }>;

  const lines: string[] = [];
  lines.push('# Référence OpenAPI — schémas générés depuis le code');
  lines.push('');
  lines.push(
    '> **Généré automatiquement** par `pnpm docs:openapi` (préférentiellement depuis `/docs-json`).',
  );
  lines.push('> Ne pas éditer à la main.');
  lines.push('');
  lines.push('| Champ | Valeur |');
  lines.push('|-------|--------|');
  lines.push(`| Titre | ${info.title ?? 'Platform Core API'} |`);
  lines.push(`| Version API | ${info.version ?? '1.0.0'} |`);
  lines.push(`| Paths | ${Object.keys(paths).length} |`);
  lines.push(`| Schemas | ${Object.keys(schemas).length} |`);
  lines.push(`| Tags | ${tags.length} |`);
  lines.push('| UI | `http://localhost:3000/docs` |');
  lines.push('');

  if (tags.length) {
    lines.push('## Tags');
    lines.push('');
    for (const tag of [...tags].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`- **${tag.name}**${tag.description ? ` — ${tag.description}` : ''}`);
    }
    lines.push('');
  }

  lines.push('## Paths');
  lines.push('');
  for (const path of Object.keys(paths).sort()) {
    const methods = paths[path] ?? {};
    const verbs = Object.keys(methods)
      .filter((m) =>
        ['get', 'post', 'put', 'patch', 'delete'].includes(m.toLowerCase()),
      )
      .map((m) => m.toUpperCase())
      .join(', ');
    lines.push(`- \`${verbs}\` \`${path}\``);
  }
  lines.push('');

  lines.push('## Schemas');
  lines.push('');
  for (const name of Object.keys(schemas).sort()) {
    lines.push(`- \`${name}\``);
  }
  lines.push('');
  return lines.join('\n');
}

function writeOutputs(doc: Record<string, unknown>): void {
  assertRequiredPaths(doc);
  mkdirSync(dirname(outJson), { recursive: true });
  mkdirSync(dirname(outRootJson), { recursive: true });
  const json = `${JSON.stringify(doc, null, 2)}\n`;
  writeFileSync(outJson, json, 'utf8');
  writeFileSync(outRootJson, json, 'utf8');
  writeFileSync(outMd, renderMarkdown(doc), 'utf8');

  const pathCount = Object.keys((doc.paths ?? {}) as object).length;
  const schemaCount = Object.keys(
    ((doc.components as { schemas?: object })?.schemas ?? {}) as object,
  ).length;
  const tagCount = Array.isArray(doc.tags) ? doc.tags.length : 0;
  console.log(
    `OK: ${pathCount} paths, ${schemaCount} schemas, ${tagCount} tags`,
  );
  console.log(`→ ${outJson}`);
  console.log(`→ ${outRootJson}`);
  console.log(`→ ${outMd}`);
}

async function main(): Promise<void> {
  const live = await fetchLiveDocs();
  if (live) {
    console.log('Using live /docs-json from running API');
    writeOutputs(live);
    return;
  }

  console.log('API /docs-json unavailable — falling back to static AST export');
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', join(__dirname, 'export-openapi-from-source.ts')],
    { cwd: root, encoding: 'utf8', env: process.env },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  // Static exporter writes edge-frontend only — mirror + validate.
  const doc = JSON.parse(readFileSync(outJson, 'utf8')) as Record<
    string,
    unknown
  >;
  writeOutputs(doc);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
