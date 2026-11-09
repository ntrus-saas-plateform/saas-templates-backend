export interface IntegrationContract {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly contractType: string | null;
  readonly version: string;
  readonly ownerRef: string | null;
  readonly description: string | null;
  readonly schemaRef: string | null;
  readonly compatibilityPolicy: string | null;
  readonly status: string;
  readonly effectiveFrom: Date | null;
  readonly deprecatedAt: Date | null;
  readonly documentationRef: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
