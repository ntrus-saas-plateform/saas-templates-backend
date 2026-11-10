import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guardrail: operator provisioning controller must not expose revocation ingest.
 * Forgery by human operators is rejected by architecture (S2S-only boundary).
 */
describe('operator cannot forge P5 revocation', () => {
  it('EdgeProvisioningController does not expose revocations route', () => {
    const src = readFileSync(
      resolve(__dirname, './provisioning.controller.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/revocations/);
    expect(src).not.toMatch(/HandleAuthorizationRevocationUseCase/);
    expect(src).toMatch(/never accepts P5 revocation forgery/);
  });

  it('S2S integration controller owns revocation ingest', () => {
    const src = readFileSync(
      resolve(__dirname, './p5-provisioning-integration.controller.ts'),
      'utf8',
    );
    expect(src).toMatch(/edge\/integrations\/p5\/provisioning/);
    expect(src).toMatch(/assertP5ServiceJwt/);
    expect(src).toMatch(/verifyRevocationEventIntegrity/);
    expect(src).toMatch(/integrityVerified: true/);
  });
});
