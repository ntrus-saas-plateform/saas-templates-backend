# P7.6 — backup restore disaster recovery

Voir `00-executive-overview.md` pour le périmètre réel.

Implémentation sous `src/modules/edge/domain|application|infrastructure/infrastructure-provisioning` et `migrations/control-plane/101_edge_p7_infrastructure_database_provisioning.sql`.

Provider opérationnel : `local-managed-v1`. Moteurs : PostgreSQL (IT), MongoDB, SurrealDB (adapters réels, admin URL requise).
