export interface OperatingModel {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly dimension: string | null;
  readonly verticalId: string | null;
  readonly status: string;
  readonly version: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
