import { Injectable, Inject } from '@nestjs/common';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';

export interface TokenIntrospectionResult {
  readonly active: boolean;
  readonly sub?: string;
  readonly exp?: number;
}

@Injectable()
export class TokenIntrospectionService {
  constructor(@Inject(APP_CONFIG) private readonly config: EnvironmentConfig) {}

  isEnabled(): boolean {
    return this.config.KEYCLOAK_TOKEN_INTROSPECTION_ENABLED;
  }

  async introspect(token: string): Promise<TokenIntrospectionResult> {
    if (!this.isEnabled()) {
      return { active: true };
    }

    const url = `${this.config.KEYCLOAK_ISSUER}/protocol/openid-connect/token/introspect`;
    const clientId = this.config.KEYCLOAK_ADMIN_ENABLED
      ? this.config.KEYCLOAK_ADMIN_CLIENT_ID
      : this.config.KEYCLOAK_CLIENT_ID;
    const clientSecret = this.config.KEYCLOAK_ADMIN_ENABLED
      ? this.config.KEYCLOAK_ADMIN_CLIENT_SECRET
      : this.config.KEYCLOAK_CLIENT_SECRET;

    const body = new URLSearchParams({
      token,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      return { active: false };
    }

    const data = (await response.json()) as {
      active?: boolean;
      sub?: string;
      exp?: number;
    };

    return {
      active: data.active === true,
      sub: data.sub,
      exp: data.exp,
    };
  }
}
