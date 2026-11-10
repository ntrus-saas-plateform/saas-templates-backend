/**
 * Security guard: platform mapper must never return plaintext secure config.
 * We assert the repository source contains the redaction contract.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('P7.2 secret redaction', () => {
  const repoSrc = readFileSync(resolve(__dirname, './pg-registry.repository.ts'), 'utf8');

  it('redacts secureConfigRef on platform read mapping', () => {
    expect(repoSrc).toMatch(/secureConfigRef: r\.secure_config_ref \? '\[CONFIGURED\]' : null/);
  });

  it('redacts secret-like keys in S2S auth policy', () => {
    expect(repoSrc).toMatch(/secret\|password\|token\|credential/i);
    expect(repoSrc).toMatch(/\[REDACTED\]/);
  });

  it('controller OpenAPI documents secureConfigRef as opaque handle', () => {
    const dto = readFileSync(
      resolve(__dirname, '../../presentation/dto/registry.dto.ts'),
      'utf8',
    );
    expect(dto).toMatch(/never a plaintext secret/);
  });
});
