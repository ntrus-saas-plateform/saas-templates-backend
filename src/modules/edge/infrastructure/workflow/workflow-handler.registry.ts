import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  createDefaultWorkflowHandlerRegistry,
  type WorkflowHandlerRegistryPort,
  type WorkflowStepHandler,
} from '../../domain/workflow/workflow-handler.port.js';
import {
  registerProductControlFoundationHandlers,
  registerProductControlMutativeLiveHandlers,
  type ProductControlLiveExecutor,
} from '../../domain/product-control/product-control-handlers.js';
import { PRODUCT_CONTROL_FOUNDATION_HANDLER_KEYS } from '../../domain/product-control/product-control.types.js';
import {
  registerInfrastructureHandlers,
  type InfrastructureLiveExecutor,
} from '../../domain/infrastructure-provisioning/infrastructure-handlers.js';
import { INFRASTRUCTURE_HANDLER_KEYS } from '../../domain/infrastructure-provisioning/infrastructure.types.js';
import {
  registerKeycloakHandlers,
  type KeycloakLiveExecutor,
} from '../../domain/keycloak-topology/keycloak-handlers.js';
import { KEYCLOAK_HANDLER_KEYS } from '../../domain/keycloak-topology/keycloak.types.js';
import {
  registerConfigurationHandlers,
  type ConfigurationLiveExecutor,
} from '../../domain/configuration-entitlement/configuration-handlers.js';
import { CONFIGURATION_HANDLER_KEYS } from '../../domain/configuration-entitlement/configuration.types.js';
import {
  registerExperienceHandlers,
  type ExperienceLiveExecutor,
} from '../../domain/product-experience/experience-handlers.js';
import { EXPERIENCE_HANDLER_KEYS } from '../../domain/product-experience/experience.types.js';
import {
  registerActivationHandlers,
  type ActivationLiveExecutor,
} from '../../domain/readiness-activation/activation-handlers.js';
import { ACTIVATION_ALL_HANDLER_KEYS } from '../../domain/readiness-activation/activation.types.js';
import {
  registerLifecycleHandlers,
  type LifecycleLiveExecutor,
} from '../../domain/tenant-lifecycle/lifecycle-handlers.js';
import { LIFECYCLE_HANDLER_KEYS } from '../../domain/tenant-lifecycle/lifecycle.types.js';
import {
  registerOnboardingHandlers,
  type OnboardingLiveExecutor,
} from '../../domain/onboarding/onboarding-handlers.js';
import { ONBOARDING_HANDLER_KEYS } from '../../domain/onboarding/onboarding.types.js';
import {
  registerReconciliationHandlers,
  type ReconciliationLiveExecutor,
} from '../../domain/reconciliation/reconciliation-handlers.js';
import { RECONCILIATION_HANDLER_KEYS } from '../../domain/reconciliation/reconciliation.types.js';
import {
  registerConnectivityAgentHandlers,
  type ConnectivityAgentLiveExecutor,
} from '../../domain/connectivity-agent/connectivity-agent-handlers.js';
import { CONNECTIVITY_AGENT_HANDLER_KEYS } from '../../domain/connectivity-agent/connectivity-agent.types.js';
import {
  registerCertificationHandlers,
  type CertificationLiveExecutor,
} from '../../domain/production-certification/certification-handlers.js';
import { CERTIFICATION_HANDLER_KEYS } from '../../domain/production-certification/certification.types.js';

export const PRODUCT_CONTROL_LIVE_EXECUTOR = Symbol('PRODUCT_CONTROL_LIVE_EXECUTOR');
export const INFRASTRUCTURE_LIVE_EXECUTOR = Symbol('INFRASTRUCTURE_LIVE_EXECUTOR');
export const KEYCLOAK_LIVE_EXECUTOR = Symbol('KEYCLOAK_LIVE_EXECUTOR');
export const CONFIGURATION_LIVE_EXECUTOR = Symbol('CONFIGURATION_LIVE_EXECUTOR');
export const EXPERIENCE_LIVE_EXECUTOR = Symbol('EXPERIENCE_LIVE_EXECUTOR');
export const ACTIVATION_LIVE_EXECUTOR = Symbol('ACTIVATION_LIVE_EXECUTOR');
export const LIFECYCLE_LIVE_EXECUTOR = Symbol('LIFECYCLE_LIVE_EXECUTOR');
export const ONBOARDING_LIVE_EXECUTOR = Symbol('ONBOARDING_LIVE_EXECUTOR');
export const RECONCILIATION_LIVE_EXECUTOR = Symbol('RECONCILIATION_LIVE_EXECUTOR');
export const AGENT_LIVE_EXECUTOR = Symbol('AGENT_LIVE_EXECUTOR');
/** 11th live executor — P7.15 Production Certification. */
export const CERTIFICATION_LIVE_EXECUTOR = Symbol('CERTIFICATION_LIVE_EXECUTOR');

/**
 * Nest-injectable façade over the domain default registry.
 * Live executors re-register P7.5 / P7.6 handlers with real use-case wiring.
 */
@Injectable()
export class WorkflowHandlerRegistry implements WorkflowHandlerRegistryPort {
  private readonly inner = createDefaultWorkflowHandlerRegistry();

  constructor(
    @Optional()
    @Inject(PRODUCT_CONTROL_LIVE_EXECUTOR)
    liveProductControl?: ProductControlLiveExecutor | null,
    @Optional()
    @Inject(INFRASTRUCTURE_LIVE_EXECUTOR)
    liveInfrastructure?: InfrastructureLiveExecutor | null,
    @Optional()
    @Inject(KEYCLOAK_LIVE_EXECUTOR)
    liveKeycloak?: KeycloakLiveExecutor | null,
    @Optional()
    @Inject(CONFIGURATION_LIVE_EXECUTOR)
    liveConfiguration?: ConfigurationLiveExecutor | null,
    @Optional()
    @Inject(EXPERIENCE_LIVE_EXECUTOR)
    liveExperience?: ExperienceLiveExecutor | null,
    @Optional()
    @Inject(ACTIVATION_LIVE_EXECUTOR)
    liveActivation?: ActivationLiveExecutor | null,
    @Optional()
    @Inject(LIFECYCLE_LIVE_EXECUTOR)
    liveLifecycle?: LifecycleLiveExecutor | null,
    @Optional()
    @Inject(ONBOARDING_LIVE_EXECUTOR)
    liveOnboarding?: OnboardingLiveExecutor | null,
    @Optional()
    @Inject(RECONCILIATION_LIVE_EXECUTOR)
    liveReconciliation?: ReconciliationLiveExecutor | null,
    @Optional()
    @Inject(AGENT_LIVE_EXECUTOR)
    liveAgent?: ConnectivityAgentLiveExecutor | null,
    @Optional()
    @Inject(CERTIFICATION_LIVE_EXECUTOR)
    liveCertification?: CertificationLiveExecutor | null,
  ) {
    if (liveProductControl) {
      registerProductControlFoundationHandlers(
        this.inner,
        PRODUCT_CONTROL_FOUNDATION_HANDLER_KEYS,
        liveProductControl,
      );
      // Overwrite UnavailableProvisioningHandler / NOT_IMPLEMENTED for provision/activate
      // when the live executor is active (BB control client may still fail closed if unset).
      registerProductControlMutativeLiveHandlers(this.inner, liveProductControl);
    }
    if (liveInfrastructure) {
      registerInfrastructureHandlers(
        this.inner,
        INFRASTRUCTURE_HANDLER_KEYS,
        liveInfrastructure,
      );
    }
    // P7.7 — Keycloak topology handlers (live executor = no simulation).
    registerKeycloakHandlers(this.inner, KEYCLOAK_HANDLER_KEYS, liveKeycloak ?? undefined);
    // P7.8 — Configuration & entitlement deployment handlers.
    registerConfigurationHandlers(
      this.inner,
      CONFIGURATION_HANDLER_KEYS,
      liveConfiguration ?? undefined,
    );
    // P7.9 — Product experience provisioning handlers.
    registerExperienceHandlers(
      this.inner,
      EXPERIENCE_HANDLER_KEYS,
      liveExperience ?? undefined,
    );
    // P7.10 — Technical readiness & activation handlers.
    registerActivationHandlers(
      this.inner,
      ACTIVATION_ALL_HANDLER_KEYS,
      liveActivation ?? undefined,
    );
    // P7.11 — Tenant technical lifecycle handlers (7th live executor).
    registerLifecycleHandlers(
      this.inner,
      LIFECYCLE_HANDLER_KEYS,
      liveLifecycle ?? undefined,
    );
    // P7.12 — Onboarding operations handlers (8th live executor).
    registerOnboardingHandlers(
      this.inner,
      ONBOARDING_HANDLER_KEYS,
      liveOnboarding ?? undefined,
    );
    // P7.13 — Reconciliation & operational governance handlers (9th live executor).
    registerReconciliationHandlers(
      this.inner,
      RECONCILIATION_HANDLER_KEYS,
      liveReconciliation ?? undefined,
    );
    // P7.14 — Connectivity agent handlers (10th live executor).
    registerConnectivityAgentHandlers(
      this.inner,
      CONNECTIVITY_AGENT_HANDLER_KEYS,
      liveAgent ?? undefined,
    );
    // P7.15 — Production certification handlers (11th live executor).
    registerCertificationHandlers(
      this.inner,
      CERTIFICATION_HANDLER_KEYS,
      liveCertification ?? undefined,
    );
  }

  register(handler: WorkflowStepHandler): void {
    this.inner.register(handler);
  }

  get(handlerKey: string): WorkflowStepHandler | null {
    return this.inner.get(handlerKey);
  }

  listKeys(): string[] {
    return this.inner.listKeys();
  }

  has(handlerKey: string): boolean {
    return this.inner.has(handlerKey);
  }
}
