import { describe, expect, it } from 'vitest';
import {
  normalizePublicAppUrl,
  publicUrlFromHostname,
  publicUrlFromSubdomain,
} from './tenant-public-url.js';

describe('tenant-public-url', () => {
  it('normalizes a full URL and strips a trailing slash', () => {
    expect(normalizePublicAppUrl('https://acme.example.com/')).toBe('https://acme.example.com');
  });

  it('accepts a bare hostname as https', () => {
    expect(normalizePublicAppUrl('acme.example.com')).toBe('https://acme.example.com');
  });

  it('uses http for localhost', () => {
    expect(publicUrlFromHostname('tenant-a.localhost:3001')).toBe('http://tenant-a.localhost:3001');
  });

  it('builds URL from subdomain + base domain', () => {
    expect(publicUrlFromSubdomain('acme', 'example.com')).toBe('https://acme.example.com');
  });

  it('treats a dotted subdomain as a hostname', () => {
    expect(publicUrlFromSubdomain('app.acme.com', 'example.com')).toBe('https://app.acme.com');
  });

  it('returns null for empty input', () => {
    expect(normalizePublicAppUrl('  ')).toBeNull();
    expect(publicUrlFromSubdomain('', 'example.com')).toBeNull();
  });
});
