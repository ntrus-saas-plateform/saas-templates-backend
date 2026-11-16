import { describe, expect, it } from 'vitest';
import {
  assertRedirectsBoundToDomains,
  checksumManifest,
  issueOwnershipToken,
  ownershipChallengeRecord,
  validateHostname,
  validateRedirectUris,
  validateWebOrigins,
} from './experience-access.policy.js';
import { ExperienceErrorCode } from './experience.types.js';

describe('experience-access.policy', () => {
  it('rejects wildcard and http non-loopback redirect URIs', () => {
    const wild = validateRedirectUris(['https://*.example.com/cb']);
    expect(wild.ok).toBe(false);
    expect(wild.issues[0]?.code).toBe(ExperienceErrorCode.REDIRECT_URI_INVALID);

    const http = validateRedirectUris(['http://evil.example/cb']);
    expect(http.ok).toBe(false);

    const loop = validateRedirectUris(['http://localhost:3000/cb'], { allowLoopbackHttp: true });
    expect(loop.ok).toBe(true);

    const https = validateRedirectUris(['https://app.tenant.example/oauth/cb']);
    expect(https.ok).toBe(true);
  });

  it('rejects wildcard web origins and pathful origins', () => {
    expect(validateWebOrigins(['*']).ok).toBe(false);
    expect(validateWebOrigins(['https://app.example.com/path']).ok).toBe(false);
    expect(validateWebOrigins(['https://app.example.com']).ok).toBe(true);
  });

  it('validates hostnames and ownership tokens', () => {
    expect(validateHostname('app.tenant.example').ok).toBe(true);
    expect(validateHostname('*.tenant.example').ok).toBe(false);
    expect(validateHostname('localhost').ok).toBe(false);

    const token = issueOwnershipToken();
    expect(token.startsWith('own_')).toBe(true);
    const challenge = ownershipChallengeRecord('app.tenant.example', token);
    expect(challenge).toMatch(/^[a-f0-9]{64}$/);
  });

  it('binds redirects to verified domains', () => {
    const ok = assertRedirectsBoundToDomains(
      ['https://app.tenant.example/cb'],
      ['app.tenant.example'],
    );
    expect(ok.ok).toBe(true);

    const bad = assertRedirectsBoundToDomains(
      ['https://other.example/cb'],
      ['app.tenant.example'],
    );
    expect(bad.ok).toBe(false);
    expect(bad.issues[0]?.code).toBe(ExperienceErrorCode.CROSS_TENANT_ROUTING);
  });

  it('checksums manifests stably', () => {
    const a = checksumManifest({ b: 1, a: 2 });
    const b = checksumManifest({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});
