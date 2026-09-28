# Backend spec — Login (Screen 05)

Email + password sign-in. The client is **mock-first** (`src/features/auth/api/authApi.ts`,
`USE_MOCK = true`) behind the same contract below; flip the flag once the endpoint is live.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).
Tokens are stored in the device keychain via `expo-secure-store` (`SecureStorage`).

---

## POST `/auth/login`

Public. Authenticates a consumer account.

**Body**
```jsonc
{ "email": "jean.dupont@email.com", "password": "••••••••" }
```

**200 Response `data`**
```jsonc
{
  "user":   { "id": "usr_...", "email": "jean.dupont@email.com", "name": "Camille" },
  "tokens": { "accessToken": "<jwt>", "refreshToken": "<opaque>" }
}
```

**Errors**
| status | case | client behavior |
|---|---|---|
| `400` | malformed / missing fields | inline field errors (client also validates via zod) |
| `401` | wrong email or password | error toast "Connexion impossible" |
| `423` | account locked (too many attempts) | toast with lockout message |

**Client rules**
- Validate before submit: `email` well-formed, `password` ≥ 8 chars (`validation.*` i18n).
- On success → persist session (`authStore.setUser`) → replace to Home `/(tabs)`.
- No `tenantId` — identity is platform-global; tenant scope starts at pharmacy search.

---

## POST `/auth/refresh`

Already consumed by the axios interceptor (`src/services/api.ts`) on `401`.
**Body** `{ "refreshToken }` → **`data`** `{ accessToken, refreshToken }`. On failure the
interceptor clears tokens and the app routes to Login.

---

## Biometric sign-in (client-side, no dedicated endpoint)

Face ID / fingerprint unlocks a **previously stored** refresh token on-device
(`expo-local-authentication` gating `expo-secure-store`); the app then calls
`/auth/refresh` to mint a fresh access token — it does **not** send biometric data to
the server. Only offered when a prior session enabled it (`settingsStore.biometricEnabled`).

> Currently mocked: the biometric button signs in a demo identity to reach Home.

---

## Notes
- Rate-limit `/auth/login` per IP + per account; return `423` on lockout.
- `GET /auth/me` (see `01-system-boot.md`) validates the persisted session on boot.
