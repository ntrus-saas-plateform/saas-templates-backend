import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEV_FALLBACK_SECRET = 'dev-only-acquisition-challenge';

export type AcquisitionPublicChallenge = {
  challengeId: string;
  challengeToken: string;
  issuedAt: Date;
  expiresAt: Date;
  /** Operands for simple math CAPTCHA (client must send a+b as challengeAnswer). */
  operandA: number;
  operandB: number;
};

type ChallengePayload = {
  id: string;
  a: number;
  b: number;
  iat: number;
  exp: number;
};

function challengeSecret(): string {
  return (
    process.env.ACQUISITION_CHALLENGE_SECRET?.trim() ||
    process.env.EDGE_CSRF_SECRET?.trim() ||
    DEV_FALLBACK_SECRET
  );
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Issue a signed public anti-bot challenge (math CAPTCHA equivalent).
 * Client must POST challengeId + challengeToken + challengeAnswer (= String(a+b)).
 */
export function issueChallenge(opts?: { ttlMs?: number; now?: Date }): AcquisitionPublicChallenge {
  const now = opts?.now ?? new Date();
  const ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;
  const challengeId = randomUUID();
  const operandA = randomInt(1, 10);
  const operandB = randomInt(1, 10);
  const issuedAt = now;
  const expiresAt = new Date(now.getTime() + ttlMs);
  const payload: ChallengePayload = {
    id: challengeId,
    a: operandA,
    b: operandB,
    iat: issuedAt.getTime(),
    exp: expiresAt.getTime(),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const challengeToken = `${encoded}.${signPayload(encoded, challengeSecret())}`;
  return {
    challengeId,
    challengeToken,
    issuedAt,
    expiresAt,
    operandA,
    operandB,
  };
}

/**
 * Verify a previously issued challenge.
 * For MVP, answer may be empty only when `requireAnswer` is false (tests);
 * production public lead capture always requires String(a+b).
 */
export function verifyChallenge(
  challengeId: string,
  challengeToken: string,
  answer?: string | null,
  opts?: { now?: Date; requireAnswer?: boolean },
): boolean {
  if (!challengeId?.trim() || !challengeToken?.trim()) return false;
  const parts = challengeToken.split('.');
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return false;

  const expectedSig = signPayload(encoded, challengeSecret());
  if (!safeEqual(sig, expectedSig)) return false;

  let payload: ChallengePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ChallengePayload;
  } catch {
    return false;
  }

  if (!payload || typeof payload !== 'object') return false;
  if (payload.id !== challengeId.trim()) return false;
  if (!Number.isFinite(payload.exp) || !Number.isFinite(payload.iat)) return false;
  if (!Number.isFinite(payload.a) || !Number.isFinite(payload.b)) return false;

  const now = opts?.now ?? new Date();
  if (now.getTime() > payload.exp) return false;

  const requireAnswer = opts?.requireAnswer !== false;
  if (requireAnswer) {
    const expected = String(payload.a + payload.b);
    if (typeof answer !== 'string' || answer.trim() !== expected) return false;
  }

  return true;
}
