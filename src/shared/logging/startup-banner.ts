import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import { SWAGGER_JSON_PATH, SWAGGER_UI_PATH } from '../swagger/swagger.constants.js';

export interface StartupBannerOptions {
  readonly config: EnvironmentConfig;
  readonly baseUrl: string;
  readonly swaggerEnabled: boolean;
  readonly apiOperationCount?: number;
}

export function printStartupBanner(options: StartupBannerOptions): void {
  const { config, baseUrl, swaggerEnabled, apiOperationCount } = options;
  const line = '─'.repeat(56);

  const rows: string[] = [
    '',
    line,
    `  ${config.SERVICE_NAME}  ·  v1.0.0  ·  ${config.NODE_ENV}`,
    line,
    `  Listen          ${baseUrl}  (bind ${config.HOST}:${config.PORT})`,
    `  API (v1)        ${baseUrl}/api/v1`,
  ];

  if (swaggerEnabled) {
    rows.push(`  Swagger UI      ${baseUrl}/${SWAGGER_UI_PATH}`);
    rows.push(`  OpenAPI JSON    ${baseUrl}/${SWAGGER_JSON_PATH}`);
    rows.push(`  Shortcuts       ${baseUrl}/api/docs  ·  ${baseUrl}/swagger`);
    if (apiOperationCount !== undefined) {
      rows.push(`  Documented ops  ${apiOperationCount}`);
    }
  } else {
    rows.push('  Swagger         disabled (set SWAGGER_ENABLED=true in production)');
  }

  rows.push(
    `  Health          ${baseUrl}/health`,
    `  Liveness        ${baseUrl}/liveness`,
    `  Readiness       ${baseUrl}/readiness`,
    `  Metrics         ${baseUrl}/metrics`,
    line,
    `  Keycloak        ${config.KEYCLOAK_ISSUER}`,
    `  Audience        ${config.KEYCLOAK_AUDIENCE} (staff) · ${config.KEYCLOAK_B2C_AUDIENCE} (B2C)`,
    `  Control plane   ${config.CONTROL_PLANE_DB_HOST}:${config.CONTROL_PLANE_DB_PORT}/${config.CONTROL_PLANE_DB_NAME}`,
    `  RabbitMQ        ${config.RABBITMQ_CONSUMER_ENABLED ? 'consumer enabled' : 'consumer disabled'}`,
    line,
    '',
  );

  console.log(rows.join('\n'));
}
