import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const coreDomainDir = join(__dirname, '..', '..', 'src', 'core', 'domain');
const identityDomainDir = join(__dirname, '..', '..', 'src', 'modules', 'identity', 'domain');
const customerDomainDir = join(__dirname, '..', '..', 'src', 'modules', 'customer', 'domain');
const commerceDomainDir = join(__dirname, '..', '..', 'src', 'modules', 'commerce', 'domain');
const pharmacyDomainDir = join(__dirname, '..', '..', 'src', 'modules', 'pharmacy', 'domain');
const applicationDir = join(__dirname, '..', '..', 'src', 'core', 'application');

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+['"]@nestjs\//,
  /from\s+['"]typeorm/,
  /from\s+['"]prisma/,
  /from\s+['"]pg['"]/,
  /from\s+['"]ioredis/,
  /from\s+['"]amqplib/,
  /from\s+['"]axios/,
  /from\s+['"]express/,
  /from\s+['"]keycloak/,
  /from\s+['"]jose['"]/,
];

function getImportLines(content: string): string[] {
  return content.split('\n').filter((line) => line.trim().startsWith('import '));
}

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Architecture: Domain Purity', () => {
  const domainFiles = [
    ...getAllTsFiles(coreDomainDir),
    ...getAllTsFiles(identityDomainDir),
    ...getAllTsFiles(customerDomainDir),
    ...getAllTsFiles(commerceDomainDir),
    ...getAllTsFiles(pharmacyDomainDir),
  ];

  it('should have domain files to test', () => {
    expect(domainFiles.length).toBeGreaterThan(0);
  });

  for (const file of domainFiles) {
    const relativePath = file.replace(join(__dirname, '..', '..'), '');
    it(`domain file ${relativePath} must not import infrastructure`, () => {
      const content = readFileSync(file, 'utf-8');
      const importLines = getImportLines(content);
      for (const line of importLines) {
        for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
          expect(line).not.toMatch(pattern);
        }
      }
    });
  }
});

describe('Architecture: Layer Boundaries', () => {
  it('presentation should not import pg directly', () => {
    const modulesDir = join(__dirname, '..', '..', 'src', 'modules');
    const files = getAllTsFiles(modulesDir).filter((file) => file.replace(/\\/g, '/').includes('/presentation/'));
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from ['"]pg['"]/);
    }
  });

  it('domain should not depend on infrastructure directory', () => {
    const files = [
      ...getAllTsFiles(coreDomainDir),
      ...getAllTsFiles(identityDomainDir),
      ...getAllTsFiles(customerDomainDir),
      ...getAllTsFiles(commerceDomainDir),
      ...getAllTsFiles(pharmacyDomainDir),
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      expect(content).not.toContain('infrastructure');
    }
  });
});

describe('Architecture: Platform Module Boundaries', () => {
  const platformDir = join(__dirname, '..', '..', 'src', 'modules', 'platform');
  const applicationDir = join(platformDir, 'application');
  const presentationDir = join(platformDir, 'presentation');

  it('platform application must not import from other modules or shared', () => {
    const files = getAllTsFiles(applicationDir);
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const importLines = getImportLines(content);
      for (const line of importLines) {
        expect(line).not.toMatch(/from\s+['"].*\/modules\/(?!platform|identity\/domain)/);
        expect(line).not.toMatch(/from\s+['"].*\/shared\//);
      }
    }
  });

  it('platform presentation must not contain business services', () => {
    const files = getAllTsFiles(presentationDir);
    for (const file of files) {
      expect(file).not.toMatch(/\.service\.ts$/);
    }
  });

  it('platform root must not contain fat application services', () => {
    const entries = readdirSync(platformDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.service.ts')) {
        throw new Error(`Fat service at modules/platform/${entry.name} — use application/use-cases`);
      }
    }
  });
});
describe('Architecture: Identity Module Boundaries', () => {
  const identityDir = join(__dirname, '..', '..', 'src', 'modules', 'identity');
  const applicationDir = join(identityDir, 'application');
  const presentationDir = join(identityDir, 'presentation');

  it('identity application must not import from other modules or shared (except messaging outbox)', () => {
    const files = getAllTsFiles(applicationDir);
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const importLines = getImportLines(content);
      for (const line of importLines) {
        expect(line).not.toMatch(/from\s+['"].*\/modules\/(?!identity)/);
        if (line.includes('/shared/messaging/')) continue;
        expect(line).not.toMatch(/from\s+['"].*\/shared\//);
      }
    }
  });

  it('identity presentation must not contain business services', () => {
    const files = getAllTsFiles(presentationDir);
    for (const file of files) {
      expect(file).not.toMatch(/\.service\.ts$/);
    }
  });

  it('identity root must not contain fat application services', () => {
    const entries = readdirSync(identityDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.service.ts')) {
        throw new Error(`Fat service at modules/identity/${entry.name} — use application/use-cases`);
      }
    }
  });
});
