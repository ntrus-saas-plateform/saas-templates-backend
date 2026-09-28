export interface ConfigurationContext {
  readonly tenantId: string;
  readonly organizationId?: string | null;
  readonly userSettings?: Readonly<Record<string, unknown>>;
  /** Ephemeral shell/request overlays — never persisted (wins over user prefs). */
  readonly sessionOverrides?: Readonly<Record<string, unknown>>;
}

export interface ConfigurationResolverPort {
  resolve<T>(fullKey: string, context: ConfigurationContext): Promise<T>;
  resolveNamespace(
    namespace: string,
    context: ConfigurationContext,
  ): Promise<Record<string, unknown>>;
}

export const CONFIGURATION_RESOLVER_PORT = Symbol('CONFIGURATION_RESOLVER_PORT');
