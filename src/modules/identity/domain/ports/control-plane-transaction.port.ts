export interface ControlPlaneTransactionPort {
  runInTransaction<T>(fn: (client: unknown) => Promise<T>): Promise<T>;
}

export const CONTROL_PLANE_TRANSACTION_PORT = Symbol('CONTROL_PLANE_TRANSACTION_PORT');
