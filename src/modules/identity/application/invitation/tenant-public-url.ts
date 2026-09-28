export function normalizePublicAppUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('://')) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      if (!url.hostname) return null;
      return `${url.protocol}//${url.host}`;
    } catch {
      return null;
    }
  }
  return publicUrlFromHostname(trimmed);
}

export function publicUrlFromHostname(hostname: string): string | null {
  const host = hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!host || host.includes('/') || host.includes(' ') || host.includes('@')) return null;
  const hostnameOnly = host.split(':')[0] ?? host;
  const scheme = isLocalHostname(hostnameOnly) ? 'http' : 'https';
  try {
    const url = new URL(`${scheme}://${host}`);
    if (!url.hostname) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function publicUrlFromSubdomain(subdomain: string, baseDomain: string): string | null {
  const label = subdomain.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  const base = baseDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!label) return null;
  if (label.includes('.')) return publicUrlFromHostname(label);
  if (!base) return null;
  return publicUrlFromHostname(`${label}.${base}`);
}

function isLocalHostname(host: string): boolean {
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host.startsWith('127.') ||
    host === '0.0.0.0' ||
    host === '::1'
  );
}
