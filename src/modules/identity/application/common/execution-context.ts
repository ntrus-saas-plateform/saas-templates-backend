/** Request-scoped identity context passed from presentation into use cases. */
export interface ExecutionContext {
  readonly tenantId: string;
  readonly subjectId: string;
  readonly username: string | null;
  readonly email?: string | null;
  readonly organizationId: string | null;
  readonly correlationId: string;
  readonly traceId: string | null;
  readonly permissions: readonly string[];
  readonly tokenId?: string | null;
  readonly tokenIssuedAt?: number | null;
}
