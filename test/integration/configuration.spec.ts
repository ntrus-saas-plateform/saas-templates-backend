import { describe, it, expect } from 'vitest';
import { parseEnvironment } from '../../src/shared/configuration/environment.schema.js';

describe('Environment Configuration', () => {
  it('should parse valid environment', () => {
    const config = parseEnvironment({
      NODE_ENV: 'test',
      PORT: '3000',
      CONTROL_PLANE_DB_PASSWORD: 'test',
    });
    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(3000);
  });

  it('should reject invalid NODE_ENV', () => {
    expect(() =>
      parseEnvironment({
        NODE_ENV: 'invalid',
        CONTROL_PLANE_DB_PASSWORD: 'test',
      }),
    ).toThrow('Invalid environment configuration');
  });

  it('should apply defaults', () => {
    const config = parseEnvironment({
      CONTROL_PLANE_DB_PASSWORD: 'test',
    });
    expect(config.SERVICE_NAME).toBe('platform-core');
    expect(config.LOG_LEVEL).toBe('info');
  });

  it('requires METRICS_AUTH_TOKEN in production', () => {
    expect(() =>
      parseEnvironment({
        NODE_ENV: 'production',
        CONTROL_PLANE_DB_PASSWORD: 'test',
      }),
    ).toThrow('METRICS_AUTH_TOKEN is required in production');
  });
});
