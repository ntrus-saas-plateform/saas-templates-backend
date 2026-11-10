import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
};

/**
 * Outbound Edge→P5 S2S tokens via OAuth2 client_credentials.
 * Reuses the same pattern as KeycloakAdminClient.getAccessToken — no custom crypto.
 */
@Injectable()
export class EdgeP5S2STokenClient {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(@Inject(APP_CONFIG) private readonly config: EnvironmentConfig) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.EDGE_P5_S2S_TOKEN_URL?.trim() &&
        this.config.EDGE_P5_S2S_CLIENT_ID?.trim() &&
        this.config.EDGE_P5_S2S_CLIENT_SECRET?.trim(),
    );
  }

  async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('P5_S2S_NOT_CONFIGURED');
    }
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 5000) {
      return this.accessToken;
    }

    const tokenUrl = this.config.EDGE_P5_S2S_TOKEN_URL!;
    if (!this.config.EDGE_P5_ALLOW_INSECURE_HTTP && !tokenUrl.startsWith('https://')) {
      throw new Error('P5_S2S_TOKEN_URL_MUST_BE_HTTPS');
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.EDGE_P5_S2S_CLIENT_ID!,
      client_secret: this.config.EDGE_P5_S2S_CLIENT_SECRET!,
    });
    if (this.config.EDGE_P5_S2S_SCOPE?.trim()) {
      body.set('scope', this.config.EDGE_P5_S2S_SCOPE.trim());
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(this.config.EDGE_P5_AUTHORIZATION_STATUS_TIMEOUT_MS ?? 2000),
    });

    if (!response.ok) {
      throw new Error(`P5_S2S_TOKEN_HTTP_${response.status}`);
    }

    const data = (await response.json()) as TokenResponse;
    if (!data.access_token) {
      throw new Error('P5_S2S_TOKEN_MISSING');
    }
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ?? 300) * 1000;
    return this.accessToken;
  }

  /** Test helper — clears cached token (rotation / failure recovery). */
  clearCache(): void {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }
}
