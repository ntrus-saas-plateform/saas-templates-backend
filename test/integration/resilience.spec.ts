import { describe, it, expect } from 'vitest';
import { withRetry, CircuitBreaker } from '../../src/shared/security/resilience.js';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const result = await withRetry(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('should retry on failure and succeed', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 2) throw new Error('fail');
        return 'ok';
      },
      { maxAttempts: 3, baseDelayMs: 10 },
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('should throw after max attempts', async () => {
    await expect(
      withRetry(async () => { throw new Error('always fails'); }, { maxAttempts: 2, baseDelayMs: 10 }),
    ).rejects.toThrow('always fails');
  });
});

describe('CircuitBreaker', () => {
  it('should start closed', () => {
    const breaker = new CircuitBreaker(2, 1000);
    expect(breaker.getState()).toBe('closed');
  });

  it('should open after threshold failures', async () => {
    const breaker = new CircuitBreaker(2, 60000);
    const failing = () => breaker.execute(async () => { throw new Error('fail'); });

    await expect(failing()).rejects.toThrow('fail');
    await expect(failing()).rejects.toThrow('fail');
    await expect(failing()).rejects.toThrow('Circuit breaker is open');
    expect(breaker.getState()).toBe('open');
  });
});
