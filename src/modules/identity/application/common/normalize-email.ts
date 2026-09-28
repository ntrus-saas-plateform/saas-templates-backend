export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function extractEmailFromUsername(username: string | null | undefined): string | null {
  if (!username) return null;
  const normalized = normalizeEmail(username);
  return normalized.includes('@') ? normalized : null;
}
