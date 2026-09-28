import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import { POLICY_EVALUATOR_PORT } from '../../core/domain/authorization/policy-evaluation.js';
import { AuthorizationService } from './authorization.service.js';
import { PolicyEvaluatorService } from './policy-evaluator.service.js';
import { InProcessPolicyEvaluator } from './in-process-policy-evaluator.js';
import { OpaPolicyEvaluator } from './opa-policy-evaluator.js';
import { CapabilityResolverService } from './capability-resolver.service.js';

@Global()
@Module({
  providers: [
    AuthorizationService,
    PolicyEvaluatorService,
    InProcessPolicyEvaluator,
    OpaPolicyEvaluator,
    CapabilityResolverService,
    {
      provide: POLICY_EVALUATOR_PORT,
      useFactory: (
        config: EnvironmentConfig,
        inProcess: InProcessPolicyEvaluator,
        opa: OpaPolicyEvaluator,
      ) => (config.OPA_ENABLED ? opa : inProcess),
      inject: [APP_CONFIG, InProcessPolicyEvaluator, OpaPolicyEvaluator],
    },
  ],
  exports: [
    AuthorizationService,
    PolicyEvaluatorService,
    POLICY_EVALUATOR_PORT,
    InProcessPolicyEvaluator,
    OpaPolicyEvaluator,
    CapabilityResolverService,
  ],
})
export class AuthorizationModule {}
