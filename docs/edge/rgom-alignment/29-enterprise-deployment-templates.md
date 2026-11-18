# 29 — Enterprise deployment templates (E2)

**Règle :** deployment profile ≠ plan tier auto on-prem.

| Template | Plan tier | Deployment | Note |
|----------|-----------|------------|------|
| `ENT_SAAS_MULTI_SITE` | ENTERPRISE | SAAS_MULTI_TENANT | Default beachhead |
| `ENT_DEDICATED` | ENTERPRISE | SAAS_DEDICATED | Quote only |
| `ENT_ONPREM` | ENTERPRISE | ON_PREM | Never auto-selected from Lite/Pro |

Publication via `PublishEnterpriseTemplateUseCase` existant — readiness READY obligatoire.
