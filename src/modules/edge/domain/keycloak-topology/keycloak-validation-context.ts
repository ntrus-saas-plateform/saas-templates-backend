/**
 * P7.7 §3 dependency gates — how the workflow validates P7.1/P7.2/P7.6 inputs.
 * Profile options come from P7.2 contracts (declaratives), never raw user input.
 */
export type KeycloakPlanValidationContext = {
  /** P7.1 — provisioning authorization state at validation time. */
  authorizationValid: boolean;
  authorizationExpired: boolean;
  authorizationRevoked: boolean;
  /** P7.3 — placement decision confirmed. */
  placementValid: boolean;
  /** Profile security requirement (TLS mandatory unless explicitly lab-only). */
  tlsRequiredByProfile: boolean;
  /** P7.2 — server-side capability gate (from discovery, not assumptions). */
  organizationsSupportedByServer: boolean;
  /** Values passed through from P7.2 runtime/deployment profiles. */
  profileOptions?: Record<string, unknown>;
};

/** Default fail-closed context when nothing has been revalidated yet. */
export const FAIL_CLOSED_VALIDATION_CONTEXT: KeycloakPlanValidationContext = {
  authorizationValid: false,
  authorizationExpired: false,
  authorizationRevoked: false,
  placementValid: false,
  tlsRequiredByProfile: true,
  organizationsSupportedByServer: false,
  profileOptions: {},
};