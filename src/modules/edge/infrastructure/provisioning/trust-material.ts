import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import type { PublicKeyMaterial } from '../../domain/provisioning/authorization-verification.js';

export function loadProvisioningTrustMaterial(config: EnvironmentConfig): {
  keys: PublicKeyMaterial[];
  allowedIssuers: string[];
} {
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
      // Misconfigured keys → empty set → verification fails closed (UNKNOWN_KEY_ID)
    }
  }

  const allowedIssuers = (config.EDGE_P7_AUTHORIZATION_ALLOWED_ISSUERS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return { keys, allowedIssuers };
}
