import type { EnvironmentConfig } from './environment.schema.js';

function displayHost(host: string): string {
  if (host === '0.0.0.0' || host === '::') return 'localhost';
  return host;
}

/** Public HTTP base URL used in Swagger, startup banner, and default CORS hints. */
export function resolvePublicBaseUrl(config: EnvironmentConfig): string {
  if (config.PUBLIC_BASE_URL) {
    return config.PUBLIC_BASE_URL.replace(/\/$/, '');
  }

  const protocol = config.PUBLIC_BASE_URL_PROTOCOL ?? 'http';
  return `${protocol}://${displayHost(config.HOST)}:${config.PORT}`;
}

export function resolveCorsOrigins(config: EnvironmentConfig, publicBaseUrl: string): string[] {
  const origins = new Set(
    config.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  );
  origins.add(publicBaseUrl);
  origins.add('http://localhost:5173');
  return [...origins];
}
