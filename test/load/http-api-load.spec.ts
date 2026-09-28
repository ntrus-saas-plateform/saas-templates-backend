import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import request from 'supertest';

describe('Load: HTTP liveness endpoint', () => {
  let server: Server;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/liveness') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('handles 100 concurrent liveness requests', async () => {
    const requests = Array.from({ length: 100 }, () => request(server).get('/liveness'));
    const responses = await Promise.all(requests);

    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    }
  });
});
