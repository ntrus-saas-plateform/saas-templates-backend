# P4 — Permissions Matrix (foundation + reserved)

| Permission | Foundation (081) | Later |
|------------|------------------|-------|
| `platform:sales:accounts:read` | ✓ | |
| `platform:sales:accounts:create` | ✓ | |
| `platform:sales:accounts:update` | ✓ | |
| `platform:sales:accounts:merge` | ✓ | |
| `platform:sales:contacts:read` | ✓ | |
| `platform:sales:contacts:manage` | ✓ | |
| `platform:sales:teams:read` | ✓ | |
| `platform:sales:teams:manage` | ✓ | |
| `platform:sales:leads:read` | ✓ | |
| `platform:sales:leads:accept` | ✓ | |
| `platform:sales:leads:reject` | ✓ | |
| `platform:sales:leads:assign` | ✓ | |
| `platform:sales:leads:qualify` | ✓ | |
| `platform:sales:activities:manage` | ✓ notes/tasks | activities full |
| `platform:sales:analytics:read` | ✓ overview | dashboards |
| `platform:sales:opportunities:*` | reserved | P4.3 |
| `platform:sales:pipeline:manage` | reserved | P4.3 |
| `platform:sales:quotes:*` / proposals / discounts | reserved | P4.6–7 |
| `platform:sales:contracts:*` / orders / handoff | reserved | P4.8–9 |
| `platform:sales:forecast:read` / governance | reserved | P4.10+ |

## Role grants (081)

- `EDGE_PLATFORM_SUPER_ADMIN` — all `platform:sales:*`
- `EDGE_PLATFORM_OPERATOR` — CRM + lead acceptance (no merge/governance/contracts)
- `VERTICAL_OWNER` / `VERTICAL_ADMIN` — read accounts/contacts/teams/leads/analytics
