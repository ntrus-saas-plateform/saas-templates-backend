export interface BusinessProfileTemplate {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly verticalId: string;
  readonly segmentId: string | null;
  readonly status: string;
  readonly version: number;
  readonly attributesSchema: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
