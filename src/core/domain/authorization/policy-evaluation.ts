/** Input for external or in-process policy evaluation (OPA-compatible shape). */
export interface PolicyEvaluationContext {
  readonly tenantId: string;
  readonly subjectId: string;
  readonly organizationId: string | null;
  readonly action: string;
  readonly resource: {
    readonly type: string;
    readonly id?: string;
    readonly attributes?: Readonly<Record<string, unknown>>;
  };
  readonly permissions: readonly string[];
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly source: 'rbac' | 'abac' | 'opa' | 'deny';
}

export interface PolicyEvaluatorPort {
  evaluate(context: PolicyEvaluationContext): Promise<AuthorizationDecision>;
}

export const POLICY_EVALUATOR_PORT = Symbol('POLICY_EVALUATOR_PORT');
