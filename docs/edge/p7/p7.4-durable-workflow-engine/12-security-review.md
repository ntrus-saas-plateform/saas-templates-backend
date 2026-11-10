# P7.4 — Revue sécurité

**Date :** 2026-11-10

| Contrôle | Statut |
|----------|--------|
| Worker identity ≠ operator | OK — `platform:workflow:worker` + endpoints séparés |
| Fencing token + lease | OK — claim SKIP LOCKED ; stale reject |
| Revalidation P7.1 | OK — fail-closed port |
| Placement COMMITTED only | OK — HELD insuffisant pour start provisioning WF |
| Handlers P7.5/6/7 | Unavailable only — jamais succès simulé |
| TX history+audit+outbox | OK |
| Définitions publiées immuables | OK — nouvelle version |
| Secrets dans snapshots | Interdit / redaction FE |
| Override manuel ≠ bypass auth | OK |

**Verdict :** acceptable pour audit code sous réserve apply 099 staging + smoke live + G1.
