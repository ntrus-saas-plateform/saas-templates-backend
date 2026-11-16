import type {
  AgentCommandRecord,
  AgentEvidenceRecord,
  AgentSpoolRecord,
  ConnectivityAgentRecord,
} from './connectivity-agent.types.js';

export const CONNECTIVITY_AGENT_REPOSITORY_PORT = Symbol(
  'CONNECTIVITY_AGENT_REPOSITORY_PORT',
);

export interface ConnectivityAgentRepositoryPort {
  createAgent(
    input: Omit<
      ConnectivityAgentRecord,
      'id' | 'createdAt' | 'updatedAt' | 'version'
    > & { id?: string; version?: number },
    client?: unknown,
  ): Promise<ConnectivityAgentRecord>;
  getAgent(id: string): Promise<ConnectivityAgentRecord | null>;
  getAgentByCode(code: string): Promise<ConnectivityAgentRecord | null>;
  listAgents(filter: {
    status?: string;
    tenantId?: string;
    productId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ConnectivityAgentRecord[]; total: number }>;
  updateAgent(
    id: string,
    patch: Partial<ConnectivityAgentRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ConnectivityAgentRecord>;

  createCommand(
    input: Omit<AgentCommandRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    },
    client?: unknown,
  ): Promise<AgentCommandRecord>;
  getCommand(id: string): Promise<AgentCommandRecord | null>;
  getCommandByNonce(
    agentId: string,
    nonce: string,
  ): Promise<AgentCommandRecord | null>;
  listCommands(filter: {
    agentId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: AgentCommandRecord[]; total: number }>;
  updateCommand(
    id: string,
    patch: Partial<AgentCommandRecord>,
    client?: unknown,
  ): Promise<AgentCommandRecord>;
  revokeActiveCommands(
    agentId: string,
    client?: unknown,
  ): Promise<{ revokedCount: number }>;

  createSpool(
    input: Omit<AgentSpoolRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    },
    client?: unknown,
  ): Promise<AgentSpoolRecord>;
  listSpool(filter: {
    agentId?: string;
    status?: string;
    limit?: number;
  }): Promise<AgentSpoolRecord[]>;
  updateSpool(
    id: string,
    patch: Partial<AgentSpoolRecord>,
    client?: unknown,
  ): Promise<AgentSpoolRecord>;

  createEvidence(
    input: Omit<AgentEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<AgentEvidenceRecord>;
  listEvidence(filter: {
    agentId?: string;
    commandId?: string;
    limit?: number;
  }): Promise<AgentEvidenceRecord[]>;

  appendHistory(
    input: {
      resourceType: string;
      resourceId: string;
      tenantId?: string | null;
      fromStatus?: string | null;
      toStatus?: string | null;
      action: string;
      reason?: string | null;
      actorId: string;
      details?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<void>;
  listHistory(filter: {
    resourceId?: string;
    resourceType?: string;
    limit?: number;
  }): Promise<
    Array<{
      id: string;
      resourceType: string;
      resourceId: string;
      tenantId: string | null;
      fromStatus: string | null;
      toStatus: string | null;
      action: string;
      reason: string | null;
      actorId: string;
      details: Record<string, unknown>;
      createdAt: Date;
    }>
  >;
}
