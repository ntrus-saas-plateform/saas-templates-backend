import { afterEach, describe, expect, it } from 'vitest';
import { issueChallenge, verifyChallenge } from './acquisition-public-challenge.js';

describe('acquisition-public-challenge', () => {
  const prevSecret = process.env.ACQUISITION_CHALLENGE_SECRET;

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.ACQUISITION_CHALLENGE_SECRET;
    else process.env.ACQUISITION_CHALLENGE_SECRET = prevSecret;
  });

  it('issues and verifies a math challenge', () => {
    process.env.ACQUISITION_CHALLENGE_SECRET = 'unit-test-challenge-secret';
    const issued = issueChallenge();
    expect(issued.challengeId).toBeTruthy();
    expect(issued.challengeToken.includes('.')).toBe(true);
    expect(issued.operandA + issued.operandB).toBeGreaterThan(0);

    const ok = verifyChallenge(
      issued.challengeId,
      issued.challengeToken,
      String(issued.operandA + issued.operandB),
    );
    expect(ok).toBe(true);
  });

  it('rejects wrong answer, wrong id, tampered token, and expiry', () => {
    process.env.ACQUISITION_CHALLENGE_SECRET = 'unit-test-challenge-secret';
    const now = new Date('2026-01-01T00:00:00.000Z');
    const issued = issueChallenge({ now, ttlMs: 60_000 });

    expect(
      verifyChallenge(issued.challengeId, issued.challengeToken, '999', { now }),
    ).toBe(false);

    expect(
      verifyChallenge('other-id', issued.challengeToken, String(issued.operandA + issued.operandB), {
        now,
      }),
    ).toBe(false);

    const [payload] = issued.challengeToken.split('.');
    expect(
      verifyChallenge(
        issued.challengeId,
        `${payload}.tampered`,
        String(issued.operandA + issued.operandB),
        { now },
      ),
    ).toBe(false);

    expect(
      verifyChallenge(
        issued.challengeId,
        issued.challengeToken,
        String(issued.operandA + issued.operandB),
        { now: new Date(now.getTime() + 120_000) },
      ),
    ).toBe(false);
  });
});
