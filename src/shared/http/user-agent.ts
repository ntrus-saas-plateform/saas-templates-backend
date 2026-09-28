/** Lightweight UA parsing for login/device metadata (not a full detector). */
export function guessBrowser(ua: string): string | null {
  if (!ua) return null;
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
  return null;
}

export function guessOs(ua: string): string | null {
  if (!ua) return null;
  if (/Windows NT/i.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iOS/i.test(ua)) return 'iOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return null;
}

export function guessDevice(ua: string): string | null {
  if (!ua) return null;
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}
