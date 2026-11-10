# P7.0 — Domain Boundary Map

```text
P4 Sales ──handoff──► P5 Subscriptions
                           │
                           ├─ entitlement snapshots (authority)
                           ├─ provisioning_authorization / request events
                           │
                           ▼
                      P7 Provisioning (TO BUILD)
                           │
                           ├─ Product Control ──► Business Backend
                           ├─ IAM topology adapters ──► Keycloak (product)
                           ├─ Infra adapters ──► DB/DNS/TLS/runtime
                           │
                           ▼
                      Evidence + Activation (technical)
                           │
                           └── events ──► P5 (complete/fail)

P6 Billing ──financial events──► P5 (interpretation only) ──► P7
Identity TenantRegistry ──≠── P7 product tenants
```

## Ownership (locked)

| Decision | Owner |
|----------|-------|
| Commercial eligibility / entitlements | P5 |
| Financial truth | P6 |
| Technical placement / workflow / evidence | P7 |
| Business orgs, users, roles, schema | Business Backend |
| Edge operator identity | P0 |

## Forbidden couplings

- P7 inventing entitlements
- P7 activating on unpaid invoice alone
- P7 owning Keycloak user memberships
- Treating establishments as Edge tenants
- Treating Identity `TenantRegistry` rows as product tenants
