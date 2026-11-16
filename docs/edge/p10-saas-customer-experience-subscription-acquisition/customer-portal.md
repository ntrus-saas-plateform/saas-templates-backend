# P10 — Customer portal

## Implémenté (API)

`GET edge/acquisition/customer-portal/:prospectId`  
→ `GetCustomerPortalSnapshotUseCase`

Snapshot agrège :

- prospect
- applications
- checkout sessions
- subscription handoffs
- `subscriptionHandoffCompleted` (bool dérivé)
- `provisioningComplete: false` (jamais inventé)
- note explicite : état acquisition seulement

Permission : `platform:acquisition:read` (console). **Pas** de portail self-serve public authentifié séparé.

## Non livré

- FE `/acquire` account area
- Auth prospect end-user (magic link / customer IdP)
- Actions mutatives depuis le portail (resume application, pay, upload)

## Statut

**Read snapshot BE DONE ; UX portail NOT STARTED.**
