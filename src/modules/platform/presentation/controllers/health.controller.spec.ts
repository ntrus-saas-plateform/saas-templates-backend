import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const dbManager = { healthCheck: vi.fn() };
  const cache = { ping: vi.fn() };
  const rabbitMq = { isConnected: vi.fn() };
  let controller: HealthController;

  const createRes = () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    return res;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new HealthController(dbManager as never, cache as never, rabbitMq as never);
  });

  it('returns 503 when readiness checks fail', async () => {
    dbManager.healthCheck.mockResolvedValue({ controlPlane: false, tenantPools: 0 });
    cache.ping.mockResolvedValue(true);
    rabbitMq.isConnected.mockReturnValue(true);
    const res = createRes();

    await controller.readiness(res as never);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'degraded' }),
    );
  });

  it('returns 200 when all readiness checks pass', async () => {
    dbManager.healthCheck.mockResolvedValue({ controlPlane: true, tenantPools: 1 });
    cache.ping.mockResolvedValue(true);
    rabbitMq.isConnected.mockReturnValue(true);
    const res = createRes();

    await controller.readiness(res as never);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
  });
});
