# P4 — Permissions Matrix

All codes seeded in migration `081` (`platform:sales:*`).

| Permission | Used by |
|------------|---------|
| `platform:sales:accounts:read/create/update/merge` | Accounts CRM |
| `platform:sales:contacts:read/manage` | Contacts |
| `platform:sales:teams:read/manage` | Teams & territories |
| `platform:sales:leads:read/accept/reject/assign/qualify` | Lead inbox |
| `platform:sales:opportunities:read/create/update/close` | Opportunities |
| `platform:sales:pipeline:manage` | Pipeline config (reserved for stage mgmt) |
| `platform:sales:activities:manage` | Activities, notes, tasks |
| `platform:sales:assessments:manage` | Needs assessments |
| `platform:sales:quotes:read/create/approve` | Quotes / offer configs |
| `platform:sales:proposals:manage` | Proposals |
| `platform:sales:discounts:request/approve` | Deal desk |
| `platform:sales:contracts:read/manage/approve` | Contracts |
| `platform:sales:orders:manage` | Sales orders |
| `platform:sales:handoff:execute` | Handoff + provisioning status |
| `platform:sales:forecast:read` | Forecast |
| `platform:sales:analytics:read` | Overview / performance |
| `platform:sales:governance:manage` | Approvals queue |

## Role grants

| Role | Grant |
|------|-------|
| `EDGE_PLATFORM_SUPER_ADMIN` | all `platform:sales:*` |
| `EDGE_PLATFORM_OPERATOR` | CRM, leads, activities, assessments, opportunities, quotes create/read, proposals, discounts request, contracts read/manage, orders, forecast, analytics — **no** merge / discounts approve / contracts approve / handoff / governance |
| `VERTICAL_OWNER` / `VERTICAL_ADMIN` | read accounts/contacts/teams/leads/opportunities/analytics |

Server enforces every mutation; frontend gates are UX only.
