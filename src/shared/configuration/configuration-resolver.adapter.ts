import { Injectable } from '@nestjs/common';
import type {
  ConfigurationContext,
  ConfigurationResolverPort,
} from '../../modules/identity/domain/ports/configuration-resolver.port.js';
import { ConfigurationResolverService } from './configuration-resolver.service.js';

@Injectable()
export class ConfigurationResolverAdapter implements ConfigurationResolverPort {
  constructor(private readonly resolver: ConfigurationResolverService) {}

  async resolve<T>(fullKey: string, context: ConfigurationContext): Promise<T> {
    return this.resolver.resolve<T>(fullKey, context);
  }

  async resolveNamespace(
    namespace: string,
    context: ConfigurationContext,
  ): Promise<Record<string, unknown>> {
    return this.resolver.resolveNamespace(namespace, context);
  }
}
