# 09 — Customer portal (remediation)

## Backend

`GET edge/acquisition/customer-portal/:prospectId` → `GetCustomerPortalSnapshotUseCase`

Snapshot : prospect, applications, checkouts, handoffs, `subscriptionHandoffCompleted`, **`provisioningComplete: false`** (jamais inventé), note « état acquisition seulement ».

Permission console : `platform:acquisition:read`.

## Frontend

- `/acquire/portal` — shell public (Playwright P10-S33/S37)
- Pas d’auth prospect end-user (magic link / customer IdP) livrée
- Pas d’actions mutatives portail (resume / pay / upload) self-serve

## Statut

Read snapshot BE + shell FE **DONE**. Portail self-serve authentifié **deferred**.
