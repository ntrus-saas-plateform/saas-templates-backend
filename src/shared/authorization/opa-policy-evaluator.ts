import { Injectable, Inject } from '@nestjs/common';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import type {
  AuthorizationDecision,
  PolicyEvaluationContext,
  PolicyEvaluatorPort,
} from '../../core/domain/authorization/policy-evaluation.js';
import { InProcessPolicyEvaluator } from './in-process-policy-evaluator.js';

/**
 * OPA adapter (RFC-style POST to /v1/data/{policy_path}).
 * Falls back to in-process evaluation when OPA is unreachable.
 */
@Injectable()
export class OpaPolicyEvaluator implements PolicyEvaluatorPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly fallback: InProcessPolicyEvaluator,
  ) {}

  async evaluate(context: PolicyEvaluationContext): Promise<AuthorizationDecision> {
    const url = `${this.config.OPA_URL}/v1/data/${this.config.OPA_POLICY_PATH}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: context }),
        signal: AbortSignal.timeout(this.config.OPA_TIMEOUT_MS),
      });

      if (!response.ok) {
        return this.fallback.evaluate(context);
      }

      const body = (await response.json()) as { result?: { allow?: boolean; reason?: string } };
      const allowed = body.result?.allow === true;
      return {
        allowed,
        reason: body.result?.reason,
        source: 'opa',
      };
    } catch {
      return this.fallback.evaluate(context);
    }
  }
}
