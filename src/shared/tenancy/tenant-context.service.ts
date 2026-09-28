import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { TenantContextData } from '../../core/domain/context/tenant-context.js';
import { EMPTY_TENANT_CONTEXT } from '../../core/domain/context/tenant-context.js';

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContextData>();

  run<T>(context: TenantContextData, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  async runAsync<T>(context: TenantContextData, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(context, fn);
  }

  get(): TenantContextData {
    return this.storage.getStore() ?? EMPTY_TENANT_CONTEXT;
  }

  getOrThrow(): TenantContextData {
    const context = this.storage.getStore();
    if (!context || !context.tenantId) {
      throw new Error('Tenant context is not available');
    }
    return context;
  }

  set(partial: Partial<TenantContextData>): void {
    const current = this.storage.getStore();
    if (!current) {
      throw new Error('Cannot set tenant context outside of a request scope');
    }
    Object.assign(current, partial);
  }
}
