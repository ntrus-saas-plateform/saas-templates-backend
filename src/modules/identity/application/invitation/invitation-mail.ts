export function buildInvitationAcceptUrl(publicAppUrl: string, token: string): string {
  const base = publicAppUrl.replace(/\/+$/, '');
  return `${base}/invite?token=${encodeURIComponent(token)}`;
}

export function buildInvitationEmail(input: {
  organizationName: string;
  acceptUrl: string;
  token: string;
  expiresAt: Date;
}): { subject: string; text: string; html: string } {
  const org = input.organizationName.trim() || 'organization';
  const expires = input.expiresAt.toISOString();
  const subject = `Invitation to join ${org} / Invitation à rejoindre ${org}`;
  const text = [
    `You have been invited to join ${org} on Atlas.`,
    `Open this link while signed in with this email: ${input.acceptUrl}`,
    `Or paste this one-time token: ${input.token}`,
    `Expires: ${expires}`,
    '',
    `Vous êtes invité(e) à rejoindre ${org} sur Atlas.`,
    `Ouvrez ce lien en étant connecté avec cet e-mail : ${input.acceptUrl}`,
    `Ou collez ce jeton à usage unique : ${input.token}`,
    `Expire le : ${expires}`,
  ].join('\n');

  const orgHtml = escapeHtml(org);
  const urlHtml = escapeHtml(input.acceptUrl);
  const tokenHtml = escapeHtml(input.token);
  const expiresHtml = escapeHtml(expires);
  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="font-family:sans-serif;line-height:1.5;color:#111">
    <p>You have been invited to join <strong>${orgHtml}</strong> on Atlas.</p>
    <p><a href="${urlHtml}">Accept invitation</a></p>
    <p>One-time token:</p>
    <p style="font-family:monospace;word-break:break-all">${tokenHtml}</p>
    <p>Expires: ${expiresHtml}</p>
    <hr />
    <p>Vous êtes invité(e) à rejoindre <strong>${orgHtml}</strong> sur Atlas.</p>
    <p><a href="${urlHtml}">Accepter l'invitation</a></p>
    <p>Jeton à usage unique :</p>
    <p style="font-family:monospace;word-break:break-all">${tokenHtml}</p>
    <p>Expire le : ${expiresHtml}</p>
  </body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
