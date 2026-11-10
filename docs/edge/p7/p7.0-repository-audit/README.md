# P7.0 — Repository Audit & Architecture Consolidation

**Authoritative pack** for Okapi Edge P7 readiness.  
**Decision:** READY WITH CONDITIONS → [Final Review](./16-final-review/P7.0_FINAL_READINESS_REVIEW.md)  
**Baseline:** [P7.0_ARCHITECTURE_BASELINE_AND_READINESS_REPORT.md](./P7.0_ARCHITECTURE_BASELINE_AND_READINESS_REPORT.md)

**Constraints honored:** documentation only — no application code, migrations, Keycloak, or infra mutations.

## Structure

| Folder | Contents |
|--------|----------|
| `01-repository-discovery/` | Inventory + actual stack |
| `02-platform-capabilities/` | P0–P6 audit + dependency matrix |
| `03-domain-model/` | Tenant domain + relationship diagram |
| `04-identity/` | Keycloak audit, topology matrix, security boundaries |
| `05-business-backend/` | BB provisioning + Product Control gap |
| `06-infrastructure/` | Infra audit + deployment profiles |
| `07-workflow/` | Saga audit + engine decision |
| `08-events-reliability/` | Events + idempotency |
| `09-security/` | Security audit + risk register |
| `10-frontend/` | Ops UI audit + screen backlog |
| `11-data/` | Data model + migration risks |
| `12-testing/` | Quality audit + coverage matrix |
| `13-architecture/` | Gaps, risks, target architecture + diagrams |
| `14-adr/` | ADR-P7-001 … 012 |
| `15-implementation-planning/` | Dependency graph, backlog, workstream matrix |
| `16-final-review/` | Final readiness decision |

Location follows existing Edge docs convention (`docs/edge/p7/…`) rather than a competing `docs/platform/` tree.
