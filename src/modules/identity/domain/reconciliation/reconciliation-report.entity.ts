export interface ReconciliationDrift {
  readonly type: string;
  readonly resourceId: string;
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly repairable: boolean;
}

export interface ReconcileKeycloakResult {
  readonly tenantId: string;
  readonly ranAt: string;
  readonly keycloakAvailable: boolean;
  readonly drifts: readonly ReconciliationDrift[];
  readonly repairs: readonly {
    type: string;
    resourceId: string;
    status: 'applied' | 'skipped' | 'failed';
  }[];
  readonly summary: { total: number; critical: number; warning: number; repaired: number };
}
