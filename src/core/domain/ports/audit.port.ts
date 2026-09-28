import type { AuditEvent } from '../audit/audit-event.js';

export interface AuditWriterPort {
  write(event: AuditEvent): Promise<void>;
}

export const AUDIT_WRITER_PORT = Symbol('AUDIT_WRITER_PORT');
