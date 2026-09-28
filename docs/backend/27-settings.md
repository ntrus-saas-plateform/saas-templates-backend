# Backend spec — Settings (Screen 27)

"Paramètres" — app preferences grouped into Général, Confidentialité & sécurité,
and Aide. A full-screen route (`/settings`) reached from the Profile tab's
"Paramètres" row.

Most of this screen is **client-side / device-local** and needs no backend:

| Row | Backing |
|---|---|
| Langue | `settingsStore.language` (persisted, MMKV) — tapping toggles fr↔en, re-renders the app live |
| Devise | `settingsStore.currency` (persisted) — display only for now (toast comingSoon) |
| Notifications | local toggle (not yet persisted) |
| Déverrouillage Face ID | `settingsStore.biometricEnabled` (persisted) |
| Changer le mot de passe | deferred → toast comingSoon |
| Données & RGPD | deferred |
| Télécharger mes données | deferred |
| Centre d'aide / Conditions & mentions légales | deferred |

Reuses the profile settings components (`SettingsGroup` / `SettingsRow` — now
supports a `control: 'switch'` variant / `IconTile`).

---

## Endpoints (deferred — none live)

When these graduate from client-local, they map to:

- **PATCH `/me/preferences`** — `{ language?, currency?, notificationsEnabled? }`.
  Server persists cross-device; the client keeps the MMKV copy as the offline
  source of truth. Notification opt-in also registers/deregisters the push token.
- **POST `/me/password`** — `{ currentPassword, newPassword }` (change, not the
  unauthenticated reset flow in `docs/backend/06-auth-forgot.md`).
- **POST `/me/data-export`** — GDPR data export; returns a job id, delivered async
  (email link / signed download). "Télécharger mes données" polls/receives it.
- **GET `/me/consent`, PATCH `/me/consent`** — view/update the RGPD consents
  captured at sign-up (`docs/backend/04-auth-signup.md`).

**Face ID** is device-local (Secure Enclave / biometric prompt); the flag only
gates whether the app offers the biometric unlock — no server state.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
| 422 | invalid preference value / weak new password |
