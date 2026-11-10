import type {
  DatabaseEngineAdapter,
  DatabaseEngineAdapterRegistryPort,
} from '../../domain/infrastructure-provisioning/database-engine.port.js';
import { DatabaseEngine } from '../../domain/infrastructure-provisioning/infrastructure.types.js';
import { MongodbDatabaseAdapter } from './mongodb-database.adapter.js';
import { PostgresqlDatabaseAdapter } from './postgresql-database.adapter.js';
import { SurrealdbDatabaseAdapter } from './surrealdb-database.adapter.js';

export class DatabaseEngineAdapterRegistry implements DatabaseEngineAdapterRegistryPort {
  private readonly adapters = new Map<DatabaseEngine, DatabaseEngineAdapter>();

  constructor() {
    this.adapters.set(DatabaseEngine.POSTGRESQL, new PostgresqlDatabaseAdapter());
    this.adapters.set(DatabaseEngine.MONGODB, new MongodbDatabaseAdapter());
    this.adapters.set(DatabaseEngine.SURREALDB, new SurrealdbDatabaseAdapter());
  }

  get(engine: DatabaseEngine): DatabaseEngineAdapter | null {
    return this.adapters.get(engine) ?? null;
  }

  listEngines(): DatabaseEngine[] {
    return [...this.adapters.keys()];
  }
}
