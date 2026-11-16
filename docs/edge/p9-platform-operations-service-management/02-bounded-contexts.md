# P9 — Bounded contexts

Contexts alignés au mandate, nommés selon conventions Edge (`platform-operations/*`).

| Context | Ownership | Dépendances |
|---------|-----------|-------------|
| `service-catalog` | Catalogue + ownership + deps | — |
| `platform-health` | Agrégation santé | catalog, monitoring, P7/P8 projections |
| `monitoring` / `alert-management` | Ingestion, lifecycle alertes | providers, maintenance |
| `incident-management` | Incidents | alerts, catalog, on-call |
| `major-incident-management` | Crise | incident |
| `problem-management` | Problèmes / RCA | incident |
| `change-management` / `release-operations` | Changements / releases | catalog, SoD |
| `maintenance-management` | Fenêtres | catalog, alerts |
| `service-request-management` | Demandes techniques internes | RBAC |
| `operational-task-management` | Tâches / interventions | runbooks |
| `on-call-management` | Astreintes / escalades | notif |
| `sla-slo-management` | SLI/SLO/error budget | metrics |
| `capacity-management` / `performance` | Capacité | P7 capacity (lecture) |
| `backup-recovery-operations` | Coordination backup/DR | infra adapters |
| `dependency-management` | Impact graph | catalog |
| `runbook-management` | Runbooks versionnés | tasks/automation |
| `operational-communications` / `status-page` | Comms + publication | approvals |
| `operational-risk-management` | Risques / exceptions | governance |
| `operational-automation` | Automation safe | workflows P7.4 |
| `operational-analytics` / `operational-audit` | Reports + audit | all |

**Règle :** pas de monolithe logique `operations.ts` unique — dossiers séparés, providers groupés.
