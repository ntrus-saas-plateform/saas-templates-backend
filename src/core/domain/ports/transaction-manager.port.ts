export interface TransactionManagerPort {
  runInTransaction<T>(tenantId: string, fn: (client: unknown) => Promise<T>): Promise<T>;
}

export const TRANSACTION_MANAGER_PORT = Symbol('TRANSACTION_MANAGER_PORT');
