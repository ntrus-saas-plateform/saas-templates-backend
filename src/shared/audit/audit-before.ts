import type { Request } from 'express';
import { sanitizeForAudit } from '../security/sanitize.js';

export const AUDIT_BEFORE_KEY = 'auditBefore';

type RequestWithAuditBefore = Request & {
  [AUDIT_BEFORE_KEY]?: Record<string, unknown> | null;
};

/** Handlers/UCs set prior entity snapshot for AuditInterceptor (§51). */
export function setAuditBefore(
  request: Request,
  before: Record<string, unknown> | null | undefined,
): void {
  (request as RequestWithAuditBefore)[AUDIT_BEFORE_KEY] = before
    ? (sanitizeForAudit(before) as Record<string, unknown> | null)
    : null;
}

export function getAuditBefore(request: Request): Record<string, unknown> | null {
  const raw = (request as RequestWithAuditBefore)[AUDIT_BEFORE_KEY];
  if (raw && typeof raw === 'object') {
    return sanitizeForAudit(raw);
  }
  return null;
}
