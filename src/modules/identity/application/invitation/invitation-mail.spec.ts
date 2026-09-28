import { describe, expect, it } from 'vitest';
import { buildInvitationAcceptUrl, buildInvitationEmail } from './invitation-mail.js';

describe('invitation-mail', () => {
  it('builds an accept URL with encoded token', () => {
    expect(buildInvitationAcceptUrl('http://localhost:3001/', 'abc+def')).toBe(
      'http://localhost:3001/invite?token=abc%2Bdef',
    );
  });

  it('includes org name, link, and token in both languages', () => {
    const mail = buildInvitationEmail({
      organizationName: 'Acme <HQ>',
      acceptUrl: 'http://localhost:3001/invite?token=tok',
      token: 'tok',
      expiresAt: new Date('2026-09-11T00:00:00.000Z'),
    });

    expect(mail.subject).toContain('Acme <HQ>');
    expect(mail.text).toContain('http://localhost:3001/invite?token=tok');
    expect(mail.text).toContain('Vous êtes invité');
    expect(mail.html).toContain('Acme &lt;HQ&gt;');
    expect(mail.html).not.toContain('Acme <HQ>');
  });
});
