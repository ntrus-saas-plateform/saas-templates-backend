import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export interface EdgeContextData {
  administratorId: string | null;
  subjectId: string | null;
  email: string | null;
  permissions: readonly string[];
  workspaceSessionId: string | null;
  verticalId: string | null;
  membershipId: string | null;
  authenticationAcr: string | null;
  tokenId: string | null;
}

export const EMPTY_EDGE_CONTEXT: EdgeContextData = {
  administratorId: null,
  subjectId: null,
  email: null,
  permissions: [],
  workspaceSessionId: null,
  verticalId: null,
  membershipId: null,
  authenticationAcr: null,
  tokenId: null,
};

@Injectable()
export class EdgeContextService {
  private readonly storage = new AsyncLocalStorage<EdgeContextData>();

  run<T>(context: EdgeContextData, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  get(): EdgeContextData {
    return this.storage.getStore() ?? EMPTY_EDGE_CONTEXT;
  }

  getOrThrow(): EdgeContextData {
    const context = this.storage.getStore();
    if (!context?.administratorId || !context.subjectId) {
      throw new Error('Edge context is not available');
    }
    return context;
  }

  set(partial: Partial<EdgeContextData>): void {
    const current = this.storage.getStore();
    if (!current) {
      // Guards may establish context after middleware; enterWith binds the remainder of the request.
      this.storage.enterWith({ ...EMPTY_EDGE_CONTEXT, ...partial });
      return;
    }
    Object.assign(current, partial);
  }

  /** Ensure ALS store exists for the request (called from middleware). */
  enter(context: EdgeContextData = EMPTY_EDGE_CONTEXT): void {
    this.storage.enterWith({ ...context });
  }
}
