export const P5_AUTHORIZATION_STATUS_PORT = Symbol('P5_AUTHORIZATION_STATUS_PORT');

export type P5AuthorizationStatusQuery = {
  readonly authorizationId: string;
  readonly authorizationVersion: number;
  readonly correlationId: string;
};

export type P5AuthorizationStatusResult =
  | {
      readonly outcome: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN' | 'DENY';
      readonly revocationVersion?: number | null;
      readonly reasonCode?: string | null;
    }
  | {
      readonly outcome: 'UNAVAILABLE';
      readonly reasonCode: string;
      readonly failureMessage: string;
    };

/**
 * Synchronous P5 status verification (OQ-04). Must fail-closed on timeout/unavailable.
 */
export interface P5AuthorizationStatusPort {
  verifyCurrentStatus(query: P5AuthorizationStatusQuery): Promise<P5AuthorizationStatusResult>;
}
