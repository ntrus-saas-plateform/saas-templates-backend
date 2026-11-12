import { describe, expect, it } from 'vitest';
import {
  assertTopologyTransition,
  assertReadyRequiresVerification,
  canTransition,
  isTerminal,
  isDestructive,
} from './keycloak-state-machine.js';
import { KeycloakTopologyStatus } from './keycloak.types.js';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';

describe('Keycloak topology state machine', () => {
  it('allows the happy-path provisioning sequence', () => {
    const path: KeycloakTopologyStatus[] = [
      KeycloakTopologyStatus.PLANNED,
      KeycloakTopologyStatus.PENDING,
      KeycloakTopologyStatus.PROVISIONING,
      KeycloakTopologyStatus.CONFIGURING,
      KeycloakTopologyStatus.VERIFYING,
      KeycloakTopologyStatus.READY,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(() => assertTopologyTransition(path[i], path[i + 1])).not.toThrow();
    }
  });

  it('forbids reaching READY without verification (fail-closed)', () => {
    expect(() =>
      assertReadyRequiresVerification(KeycloakTopologyStatus.PROVISIONING, KeycloakTopologyStatus.READY),
    ).toThrow(DomainError);
    expect(() =>
      assertReadyRequiresVerification(KeycloakTopologyStatus.CONFIGURING, KeycloakTopologyStatus.READY),
    ).toThrow(DomainError);
    // From VERIFYING it is allowed.
    expect(() =>
      assertReadyRequiresVerification(KeycloakTopologyStatus.VERIFYING, KeycloakTopologyStatus.READY),
    ).not.toThrow();
    // READY → READY (idempotent re-assert) allowed.
    expect(() =>
      assertReadyRequiresVerification(KeycloakTopologyStatus.READY, KeycloakTopologyStatus.READY),
    ).not.toThrow();
  });

  it('allows FAILED → QUARANTINED and FAILED → PROVISIONING (retry)', () => {
    expect(() =>
      assertTopologyTransition(KeycloakTopologyStatus.FAILED, KeycloakTopologyStatus.QUARANTINED),
    ).not.toThrow();
    expect(() =>
      assertTopologyTransition(KeycloakTopologyStatus.FAILED, KeycloakTopologyStatus.PROVISIONING),
    ).not.toThrow();
  });

  it('allows READY → DEPROVISIONING_PENDING only through explicit flow', () => {
    expect(() =>
      assertTopologyTransition(
        KeycloakTopologyStatus.READY,
        KeycloakTopologyStatus.DEPROVISIONING_PENDING,
      ),
    ).not.toThrow();
    // But never READY → DEPROVISIONED directly (must pass through pending).
    expect(() =>
      assertTopologyTransition(KeycloakTopologyStatus.READY, KeycloakTopologyStatus.DEPROVISIONED),
    ).toThrow();
  });

  it('treats DEPROVISIONED as terminal', () => {
    expect(isTerminal(KeycloakTopologyStatus.DEPROVISIONED)).toBe(true);
    expect(isTerminal(KeycloakTopologyStatus.READY)).toBe(false);
    for (const to of Object.values(KeycloakTopologyStatus)) {
      expect(canTransition(KeycloakTopologyStatus.DEPROVISIONED, to)).toBe(false);
    }
  });

  it('flags destructive states', () => {
    expect(isDestructive(KeycloakTopologyStatus.DEPROVISIONING_PENDING)).toBe(true);
    expect(isDestructive(KeycloakTopologyStatus.DEPROVISIONED)).toBe(true);
    expect(isDestructive(KeycloakTopologyStatus.READY)).toBe(false);
    expect(isDestructive(KeycloakTopologyStatus.PROVISIONING)).toBe(false);
  });

  it('rejects unknown/invalid statuses', () => {
    expect(() =>
      assertTopologyTransition(KeycloakTopologyStatus.READY, 'NOT_A_STATUS' as KeycloakTopologyStatus),
    ).toThrow();
    expect(() =>
      assertTopologyTransition('BOGUS' as KeycloakTopologyStatus, KeycloakTopologyStatus.READY),
    ).toThrow();
    expect(canTransition('BOGUS' as KeycloakTopologyStatus, KeycloakTopologyStatus.READY)).toBe(false);
  });

  it('requires QUARANTINE escape through an explicit transition', () => {
    // QUARANTINED cannot jump to READY directly (must re-provision/verify).
    expect(() =>
      assertTopologyTransition(KeycloakTopologyStatus.QUARANTINED, KeycloakTopologyStatus.READY),
    ).toThrow();
    expect(() =>
      assertTopologyTransition(KeycloakTopologyStatus.QUARANTINED, KeycloakTopologyStatus.PROVISIONING),
    ).not.toThrow();
  });
});
