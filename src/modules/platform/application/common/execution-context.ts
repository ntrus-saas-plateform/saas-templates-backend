/** Request-scoped context passed from presentation into platform use cases. */
export interface ExecutionContext {
  readonly tenantId: string;
  readonly subjectId: string;
  readonly username: string | null;
  readonly organizationId: string | null;
  readonly correlationId: string;
  readonly traceId: string | null;
  readonly permissions: readonly string[];
}
