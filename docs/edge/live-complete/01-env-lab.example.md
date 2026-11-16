# 01 — Lab env (copy-paste)

Paste into local `.env` / compose overrides for the Edge live-complete lab. Secrets shown are **lab-only** — rotate for any shared staging.

```bash
# --- Live path adapters ---
BILLING_PAYMENT_ADAPTER=sandbox
EDGE_P7_PROVISIONING_ADAPTER=durable

# --- Business backend control/v1 (tenant ready / provision) ---
EDGE_BB_CONTROL_BASE_URL=http://host.docker.internal:3100
EDGE_BB_CONTROL_TOKEN=lab-edge-control-token
EDGE_BB_CONTROL_ALLOW_INSECURE_HTTP=true

# --- Product control / PCI (Edge → BB HTTP) ---
# EDGE_PCI_CREDENTIALS_JSON={"lab-ref":{"authProfile":"BEARER","material":{"token":"lab-edge-control-token"}}}
EDGE_PCI_ALLOW_INSECURE_HTTP=true
EDGE_PCI_TIMEOUT_MS=15000

# --- Keycloak (compose defaults; adjust host when API runs on host vs container) ---
KEYCLOAK_ISSUER=http://keycloak:8080/realms/platform
KEYCLOAK_JWKS_URI=http://keycloak:8080/realms/platform/protocol/openid-connect/certs
KEYCLOAK_AUDIENCE=platform-api
KEYCLOAK_CLIENT_ID=platform-api
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin
KEYCLOAK_ADMIN_ENABLED=true
KEYCLOAK_ADMIN_URL=http://keycloak:8080
KEYCLOAK_ADMIN_REALM=platform
KEYCLOAK_ADMIN_CLIENT_ID=platform-admin
KEYCLOAK_ADMIN_CLIENT_SECRET=platform-admin-secret

# --- Control-plane DB / bus (compose service names) ---
CONTROL_PLANE_DB_HOST=postgres
CONTROL_PLANE_DB_PORT=5432
CONTROL_PLANE_DB_NAME=platform_control
CONTROL_PLANE_DB_USER=platform
CONTROL_PLANE_DB_PASSWORD=platform
REDIS_HOST=redis
REDIS_PORT=6379
RABBITMQ_URL=amqp://platform:platform@rabbitmq:5672
```

Notes:

- Leave `EDGE_BB_CONTROL_BASE_URL` empty to keep portal `provisioningComplete` fail-closed (`UNAVAILABLE` runtime status adapter).
- Do not set durable / sandbox in production without corresponding secrets and HTTPS.
