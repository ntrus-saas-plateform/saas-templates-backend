/**
 * RGOM-E8 / G5 — HyperSwitch (and payment adapters) = orchestration only.
 * Never import commercial catalogue seeds or own plan/price SoT.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const BILLING_INFRA = join(__dirname);

function listTsFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .map((f) => join(dir, f));
}

describe('payment orchestration boundaries (HyperSwitch ≠ catalogue SoT)', () => {
  it('Hyperswitch adapter source declares orchestration-only and edge-billing SoT', () => {
    const src = readFileSync(join(BILLING_INFRA, 'hyperswitch-payment.adapter.ts'), 'utf8');
    expect(src).toMatch(/orchestrationOnly = true/);
    expect(src).toMatch(/soT: 'edge-billing'/);
    expect(src).toMatch(/role: 'orchestration'/);
    expect(src).toMatch(/never catalogue/);
  });

  it('payment adapters never import commercial catalogue seeds', () => {
    const forbidden = [
      'syntix-pharma-catalog.seed',
      'commercial.entity',
      'offer-configurator',
      'price-book',
      'planEntitlementSnapshot',
    ];
    const files = listTsFiles(BILLING_INFRA).filter((f) =>
      /payment|hyperswitch|sandbox|webhook|resolving|unavailable/i.test(f),
    );
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const needle of forbidden) {
        expect(src.includes(needle), `${file} must not import ${needle}`).toBe(false);
      }
    }
  });

  it('PaymentProviderPort surface has no catalogue/plan methods', () => {
    const portPath = join(
      __dirname,
      '..',
      '..',
      'domain',
      'billing',
      'payment-provider.port.ts',
    );
    const src = readFileSync(portPath, 'utf8');
    expect(src).not.toMatch(/createPlan|upsertPrice|listPlans|priceBook/i);
    expect(src).toMatch(/createPaymentIntent/);
    expect(src).toMatch(/refundPayment/);
  });
});
