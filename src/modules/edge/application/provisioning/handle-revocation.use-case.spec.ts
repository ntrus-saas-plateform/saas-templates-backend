import { HandleAuthorizationRevocationUseCase } from './provisioning.use-cases.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { RevocationStatus } from '../../domain/provisioning/provisioning.types.js';

describe('HandleAuthorizationRevocationUseCase', () => {
  const baseInput = {
    actorId: 's2s:p5-client',
    eventId: 'evt-1',
    eventName: 'subscription.provisioning.authorization.revoked.v1',
    authorizationId: 'auth-1',
    revocationVersion: 2,
    integrityVerified: true as const,
  };

  it('returns DUPLICATE when inbox already consumed', async () => {
    const repo = {
      applyRevocationAtomically: vi.fn(async () => ({
        outcome: 'DUPLICATE' as const,
        authorization: null,
      })),
    };
    const outbox = { runWithOutbox: vi.fn() };
    const audit = { create: vi.fn() };
    const uc = new HandleAuthorizationRevocationUseCase(repo as never, outbox as never, audit as never);
    await expect(uc.execute(baseInput)).resolves.toEqual({ outcome: 'DUPLICATE' });
    expect(outbox.runWithOutbox).not.toHaveBeenCalled();
    expect(audit.create).not.toHaveBeenCalled();
  });

  it('never advertises APPLIED / outbox for stale revocation version', async () => {
    const repo = {
      applyRevocationAtomically: vi.fn(async () => ({
        outcome: 'IGNORED_STALE' as const,
        authorization: null,
      })),
    };
    const outbox = { runWithOutbox: vi.fn() };
    const audit = { create: vi.fn() };
    const uc = new HandleAuthorizationRevocationUseCase(repo as never, outbox as never, audit as never);
    await expect(uc.execute(baseInput)).resolves.toEqual({
      outcome: 'IGNORED_STALE',
      authorization: null,
    });
    expect(outbox.runWithOutbox).not.toHaveBeenCalled();
    expect(audit.create).not.toHaveBeenCalled();
  });

  it('fails closed when outbox is unavailable after apply', async () => {
    const repo = {
      applyRevocationAtomically: vi.fn(async () => ({
        outcome: 'APPLIED' as const,
        authorization: {
          authorizationId: 'auth-1',
          revocationStatus: RevocationStatus.REVOKED,
        },
      })),
    };
    const outbox = {
      runWithOutbox: vi.fn(async () => {
        throw new Error('outbox down');
      }),
    };
    const audit = { create: vi.fn() };
    const uc = new HandleAuthorizationRevocationUseCase(repo as never, outbox as never, audit as never);
    await expect(uc.execute(baseInput)).rejects.toMatchObject({
      code: ErrorCode.DEPENDENCY_UNAVAILABLE,
    });
    expect(audit.create).not.toHaveBeenCalled();
  });

  it('fails closed when audit writer is missing for sensitive revoke', async () => {
    const repo = {
      applyRevocationAtomically: vi.fn(async () => ({
        outcome: 'APPLIED' as const,
        authorization: {
          authorizationId: 'auth-1',
          revocationStatus: RevocationStatus.REVOKED,
        },
      })),
    };
    const outbox = {
      runWithOutbox: vi.fn(async (_t: string, fn: (c: unknown, enqueue: unknown) => Promise<void>) =>
        fn(null, vi.fn()),
      ),
    };
    const uc = new HandleAuthorizationRevocationUseCase(repo as never, outbox as never, undefined);
    await expect(uc.execute(baseInput)).rejects.toBeInstanceOf(DomainError);
  });

  it('simulates two concurrent revocations: first APPLIED, second DUPLICATE/stale', async () => {
    let calls = 0;
    const repo = {
      applyRevocationAtomically: vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return {
            outcome: 'APPLIED' as const,
            authorization: {
              authorizationId: 'auth-1',
              revocationStatus: RevocationStatus.REVOKED,
            },
          };
        }
        return { outcome: 'DUPLICATE' as const, authorization: null };
      }),
    };
    const outbox = {
      runWithOutbox: vi.fn(async (_t: string, fn: (c: unknown, enqueue: unknown) => Promise<void>) =>
        fn(null, vi.fn()),
      ),
    };
    const audit = { create: vi.fn(async () => undefined) };
    const uc = new HandleAuthorizationRevocationUseCase(repo as never, outbox as never, audit as never);
    const [a, b] = await Promise.all([
      uc.execute({ ...baseInput, eventId: 'evt-a' }),
      uc.execute({ ...baseInput, eventId: 'evt-a' }),
    ]);
    const outcomes = [a.outcome, b.outcome].sort();
    expect(outcomes).toEqual(['APPLIED', 'DUPLICATE']);
  });
});
