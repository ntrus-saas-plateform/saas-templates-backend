/**
 * RGOM-E9 — Measurable Aha moments (beachhead).
 * Login ≠ activation ≠ Aha. Events are declared codes; ingestion from BB is separate.
 */

export type AhaProductSegment = 'RETAIL_PHARMACY' | 'WHOLESALE' | 'RESTAURANT';

export type AhaMomentDefinition = {
  readonly code: string;
  readonly productSegment: AhaProductSegment;
  readonly title: string;
  readonly description: string;
  readonly targetDay: number;
};

export const AHA_MOMENTS_BEACHHEAD: readonly AhaMomentDefinition[] = [
  {
    code: 'pharmacy.first_login',
    productSegment: 'RETAIL_PHARMACY',
    title: 'First admin login',
    description: 'Admin accepts invite and signs in — necessary but not sufficient for TTV.',
    targetDay: 0,
  },
  {
    code: 'pharmacy.catalog.seeded',
    productSegment: 'RETAIL_PHARMACY',
    title: 'Catalog seeded',
    description: 'Minimal product/stock catalog present for operations.',
    targetDay: 1,
  },
  {
    code: 'pharmacy.first_sale',
    productSegment: 'RETAIL_PHARMACY',
    title: 'First sale / dispensation',
    description: 'Primary Aha for retail pharmacy beachhead.',
    targetDay: 3,
  },
  {
    code: 'pharmacy.inventory.reconciled',
    productSegment: 'RETAIL_PHARMACY',
    title: 'Inventory reconciled',
    description: 'Stock count completed against system.',
    targetDay: 14,
  },
  {
    code: 'wholesale.first_login',
    productSegment: 'WHOLESALE',
    title: 'First admin login',
    description: 'Wholesale admin signs in — not Aha by itself.',
    targetDay: 0,
  },
  {
    code: 'wholesale.price_list.published',
    productSegment: 'WHOLESALE',
    title: 'Price list published',
    description: 'Customer-facing price list available for order capture.',
    targetDay: 2,
  },
  {
    code: 'wholesale.first_order',
    productSegment: 'WHOLESALE',
    title: 'First B2B order',
    description: 'Primary Aha for wholesale beachhead.',
    targetDay: 5,
  },
  {
    code: 'wholesale.delivery.confirmed',
    productSegment: 'WHOLESALE',
    title: 'First delivery confirmed',
    description: 'Order fulfilled and acknowledged in system.',
    targetDay: 10,
  },
  {
    code: 'restaurant.first_login',
    productSegment: 'RESTAURANT',
    title: 'First admin login',
    description: 'Site admin signs in — not Aha by itself.',
    targetDay: 0,
  },
  {
    code: 'restaurant.menu.published',
    productSegment: 'RESTAURANT',
    title: 'Menu published',
    description: 'Active menu available for POS / ordering.',
    targetDay: 1,
  },
  {
    code: 'restaurant.first_ticket',
    productSegment: 'RESTAURANT',
    title: 'First ticket / cover',
    description: 'Primary Aha for restaurant independent beachhead.',
    targetDay: 3,
  },
  {
    code: 'restaurant.shift.closed',
    productSegment: 'RESTAURANT',
    title: 'First shift closed',
    description: 'End-of-day / shift close completed with cash reconciliation.',
    targetDay: 7,
  },
] as const;

export function listAhaMomentsForSegment(
  segment: AhaProductSegment,
): AhaMomentDefinition[] {
  return AHA_MOMENTS_BEACHHEAD.filter((m) => m.productSegment === segment);
}

export function findAhaMomentDefinition(code: string): AhaMomentDefinition | undefined {
  return AHA_MOMENTS_BEACHHEAD.find((m) => m.code === code);
}

export function isKnownAhaMomentCode(code: string): boolean {
  return findAhaMomentDefinition(code) != null;
}
