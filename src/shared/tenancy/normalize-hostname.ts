const IP_V4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IP_V6_RE = /^\[?[0-9a-fA-F:]+\]?$/;

/**
 * Normalises an incoming Host header value to a bare hostname:
 * - lowercase
 * - strip port suffix
 * - strip trailing dot
 * - trim whitespace
 *
 * Returns null when no domain mapping is required:
 * - empty / blank input
 * - IPv4 address (including 127.0.0.1)
 * - IPv6 address
 * - `localhost` (and `localhost.localdomain`)
 */
export function normalizeHostname(raw: string | undefined): string | null {
  if (!raw) return null;

  // Strip port
  const withoutPort = raw.replace(/:\d+$/, '');

  // Trim and lowercase
  const hostname = withoutPort.trim().toLowerCase().replace(/\.$/, '');

  if (!hostname) return null;
  if (hostname === 'localhost' || hostname.startsWith('localhost.')) return null;
  if (IP_V4_RE.test(hostname)) return null;
  if (IP_V6_RE.test(hostname)) return null;

  return hostname;
}
