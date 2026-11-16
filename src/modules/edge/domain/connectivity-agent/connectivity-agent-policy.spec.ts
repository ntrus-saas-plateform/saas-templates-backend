import { describe, expect, it } from 'vitest';
import {
  assertNonceFormat,
  assertNonceUnused,
  assertOutboundOnly,
  assertPublicKeyRefVaultOnly,
  canIssueCommand,
  canRegisterAgent,
  canRevokeAgent,
  isActiveCommandStatus,
  isVaultPublicKeyRef,
} from './connectivity-agent-policy.js';
import {
  AgentCommandStatus,
  AgentStatus,
  ConnectivityAgentErrorCode,
  type AgentCommandRecord,
} from './connectivity-agent.types.js';

describe('outbound_only policy', () => {
  it('requires outboundOnly=true', () => {
    expect(assertOutboundOnly({ outboundOnly: true })).toEqual({ allowed: true });
    const d = assertOutboundOnly({ outboundOnly: false });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(ConnectivityAgentErrorCode.OUTBOUND_ONLY_REQUIRED);
  });
});

describe('public_key_ref vault-only', () => {
  it('accepts vault: and sec_ refs', () => {
    expect(isVaultPublicKeyRef('vault:agents/pubkey/abc')).toBe(true);
    expect(isVaultPublicKeyRef('sec_agent_key_01')).toBe(true);
    expect(assertPublicKeyRefVaultOnly('vault:agents/x').allowed).toBe(true);
  });

  it('rejects plaintext PEM / raw material', () => {
    expect(
      isVaultPublicKeyRef('-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----'),
    ).toBe(false);
    const d = assertPublicKeyRefVaultOnly('plaintext-key-material');
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(ConnectivityAgentErrorCode.PLAINTEXT_KEY_FORBIDDEN);
  });
});

describe('nonce anti-replay', () => {
  it('requires 64-char hex nonce', () => {
    expect(assertNonceFormat('abcd').allowed).toBe(false);
    expect(
      assertNonceFormat('a'.repeat(64)).allowed,
    ).toBe(true);
  });

  it('rejects reused nonce', () => {
    const existing = { id: 'cmd-1' } as AgentCommandRecord;
    const d = assertNonceUnused(existing);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(ConnectivityAgentErrorCode.NONCE_REPLAY);
    expect(assertNonceUnused(null).allowed).toBe(true);
  });
});

describe('canRegisterAgent / canIssueCommand / canRevokeAgent', () => {
  it('allows register when outbound + vault key', () => {
    expect(
      canRegisterAgent({
        outboundOnly: true,
        publicKeyRef: 'vault:agents/pk1',
      }),
    ).toEqual({ allowed: true });
  });

  it('blocks register when outboundOnly false', () => {
    const d = canRegisterAgent({
      outboundOnly: false,
      publicKeyRef: 'vault:agents/pk1',
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(ConnectivityAgentErrorCode.OUTBOUND_ONLY_REQUIRED);
  });

  it('issues command only for ACTIVE + unique nonce', () => {
    const ok = canIssueCommand({
      agentStatus: AgentStatus.ACTIVE,
      outboundOnly: true,
      nonce: 'b'.repeat(64),
      existingNonceCommand: null,
    });
    expect(ok).toEqual({ allowed: true });

    const revoked = canIssueCommand({
      agentStatus: AgentStatus.REVOKED,
      outboundOnly: true,
      nonce: 'b'.repeat(64),
      existingNonceCommand: null,
    });
    expect(revoked.allowed).toBe(false);
    if (!revoked.allowed) expect(revoked.code).toBe(ConnectivityAgentErrorCode.AGENT_REVOKED);
  });

  it('revoke fail-closed on already REVOKED', () => {
    const d = canRevokeAgent(AgentStatus.REVOKED);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(ConnectivityAgentErrorCode.CONFLICT);
    expect(canRevokeAgent(AgentStatus.ACTIVE)).toEqual({ allowed: true });
  });

  it('marks pending/queued/dispatched/acked as active for revoke clear', () => {
    expect(isActiveCommandStatus(AgentCommandStatus.QUEUED)).toBe(true);
    expect(isActiveCommandStatus(AgentCommandStatus.SUCCEEDED)).toBe(false);
    expect(isActiveCommandStatus(AgentCommandStatus.REVOKED)).toBe(false);
  });
});
