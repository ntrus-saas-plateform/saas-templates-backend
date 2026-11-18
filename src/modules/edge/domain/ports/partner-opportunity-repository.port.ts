import type {
  PartnerOpportunityRegistration,
  PartnerOpportunityStatus,
  RegisterPartnerOpportunityInput,
} from '../partners/opportunity-registration.js';

export const PARTNER_OPPORTUNITY_REPOSITORY_PORT = Symbol(
  'PARTNER_OPPORTUNITY_REPOSITORY_PORT',
);

export interface PartnerOpportunityRepositoryPort {
  register(
    input: RegisterPartnerOpportunityInput & {
      conflictWindowDays: number;
      estimatedMrr: number | null;
      registeredAt: Date;
      conflictExpiresAt: Date;
      status: PartnerOpportunityStatus;
    },
  ): Promise<PartnerOpportunityRegistration>;
  getById(id: string): Promise<PartnerOpportunityRegistration | null>;
  list(input?: {
    partnerCode?: string;
    status?: PartnerOpportunityStatus;
    limit?: number;
  }): Promise<PartnerOpportunityRegistration[]>;
  updateStatus(input: {
    id: string;
    status: PartnerOpportunityStatus;
  }): Promise<PartnerOpportunityRegistration>;
}
