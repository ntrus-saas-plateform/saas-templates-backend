import {
  assertPaymentMethodAllowedForGeo,
  listGeoPaymentMethods,
} from '../../domain/billing/geo-payment-methods.js';
import type { BillingRepositoryPort } from '../../domain/ports/billing-repository.port.js';

export class ListGeoPaymentMethodsUseCase {
  execute(input?: {
    country?: string | null;
    currency?: string | null;
    methodType?: string | null;
    includePlanned?: boolean;
  }) {
    const methods = listGeoPaymentMethods(input);
    return {
      data: {
        beachhead: 'syntix-waemu',
        methods,
        notes: [
          'Catalog = declared availability for beachhead markets.',
          'Registration stores tokenized provider refs only — never PAN/MSISDN secrets.',
          'Collected cash still requires SUCCEEDED payment intents.',
        ],
      },
    };
  }
}

/** Validate geo before registering a tokenized payment method. */
export class RegisterGeoPaymentMethodUseCase {
  constructor(private readonly billing: BillingRepositoryPort) {}

  async execute(input: {
    billingAccountId: string;
    provider: string;
    providerMethodRef: string;
    methodType: string;
    brand?: string | null;
    last4?: string | null;
    country?: string | null;
    currency?: string | null;
    isDefault?: boolean;
  }) {
    const account = await this.billing.getBillingAccount(input.billingAccountId);
    const currency =
      input.currency?.trim().toUpperCase() || account?.currency?.toUpperCase() || null;

    const offer = assertPaymentMethodAllowedForGeo({
      methodType: input.methodType,
      brand: input.brand,
      country: input.country,
      currency,
      provider: input.provider,
    });

    const method = await this.billing.registerPaymentMethod({
      billingAccountId: input.billingAccountId,
      provider: input.provider,
      providerMethodRef: input.providerMethodRef,
      methodType: offer.methodType,
      brand: input.brand ?? offer.brand,
      last4: input.last4 ?? null,
      isDefault: input.isDefault,
      country: input.country ?? null,
      currency,
    });

    return {
      data: {
        method,
        geoOffer: {
          code: offer.code,
          status: offer.status,
          notes: offer.notes,
        },
      },
    };
  }
}
