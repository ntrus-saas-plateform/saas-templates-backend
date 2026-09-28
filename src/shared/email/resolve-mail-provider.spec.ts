import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '../configuration/environment.schema.js';
import { resolveMailProvider } from './resolve-mail-provider.js';

function config(overrides: Record<string, string> = {}) {
  return parseEnvironment({
    CONTROL_PLANE_DB_PASSWORD: 'test',
    ...overrides,
  });
}

describe('resolveMailProvider', () => {
  it('returns none when auto and no credentials', () => {
    expect(resolveMailProvider(config())).toBe('none');
  });

  it('prefers Resend in auto when API key is set', () => {
    expect(resolveMailProvider(config({ RESEND_API_KEY: 're_test' }))).toBe('resend');
  });

  it('uses SMTP in auto when only SMTP_HOST is set', () => {
    expect(resolveMailProvider(config({ SMTP_HOST: 'smtp.resend.com' }))).toBe('smtp');
  });

  it('honors explicit smtp even if Resend key is present', () => {
    expect(
      resolveMailProvider(
        config({ MAIL_PROVIDER: 'smtp', RESEND_API_KEY: 're_test', SMTP_HOST: 'localhost' }),
      ),
    ).toBe('smtp');
  });

  it('honors explicit none', () => {
    expect(resolveMailProvider(config({ MAIL_PROVIDER: 'none', RESEND_API_KEY: 're_test' }))).toBe(
      'none',
    );
  });
});
