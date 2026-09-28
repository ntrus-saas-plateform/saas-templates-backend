export interface Plan {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly maxOrganizations: number;
  readonly maxUsers: number;
  readonly maxCustomers: number;
  readonly maxProducts: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PlanModule {
  readonly planId: string;
  readonly moduleKey: string;
  readonly enabled: boolean;
}
