import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import type { PublicKeyMaterial } from '../../domain/provisioning/authorization-verification.js';

export type ProvisioningTrustMaterial = {
  keys: PublicKeyMaterial[];
  allowedIssuers: string[];
};

/**
 * Load trust material. Empty issuers or empty keys are left empty so verifiers fail-closed
 * with ALLOWED_ISSUERS_NOT_CONFIGURED / TRUST_KEYS_NOT_CONFIGURED / UNKNOWN_KEY_ID.
 */
export function loadProvisioningTrustMaterial(
  config: EnvironmentConfig,
): ProvisioningTrustMaterial {
  const keys: PublicKeyMaterial[] = [];
  const raw = config.EDGE_P7_AUTHORIZATION_PUBLIC_KEYS_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Array<{
        keyId?: string;
        algorithm?: string;
        publicKeyPem?: string;
      }>;
      for (const item of parsed) {
        if (item?.keyId && item?.algorithm && item?.publicKeyPem) {
          keys.push({
            keyId: item.keyId,
            algorithm: item.algorithm,
            publicKeyPem: item.publicKeyPem,
          });
        }
      }
    } catch {
      // Misconfigured JSON → empty keys → fail-closed
    }
  }

  const allowedIssuers = (config.EDGE_P7_AUTHORIZATION_ALLOWED_ISSUERS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return { keys, allowedIssuers };
}

export function assertTrustMaterialConfigured(trust: ProvisioningTrustMaterial): void {
  if (!trust.allowedIssuers.length) {
    throw new Error('ALLOWED_ISSUERS_NOT_CONFIGURED');
  }
  if (!trust.keys.length) {
    throw new Error('TRUST_KEYS_NOT_CONFIGURED');
  }
}
