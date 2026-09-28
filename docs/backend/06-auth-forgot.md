# Backend spec — Forgot / Reset password (Screen 22)

Email → secure reset link (30-min expiry). Client is **mock-first** (Send simulates
dispatch, toasts, and returns to Login). The email deep-link reopens the app on a
reset-password form that reuses this screen's field pattern.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## POST `/auth/forgot-password`

Public. Always responds **200 regardless of whether the email exists** (no account
enumeration).

**Body** `{ "email": "camille.martin@email.com" }`

**200 Response `data`** `{ "message": "If the address exists, a reset link was sent." }`

**Client behavior** → success toast (`forgot.sentToast`) → replace to Login.

---

## POST `/auth/reset-password`  (deep-link target)

Public. Consumes the emailed token and sets a new password.

**Body** `{ "token": "<from email link>", "password": "••••••••" }`

**Errors**
| status | case |
|---|---|
| `400` | weak password (client validates ≥ 8 first) |
| `410` | token expired (> 30 min) or already used |

---

## Notes
- No `tenantId` — account recovery is platform-global.
- Token: single-use, 30-min TTL, stored hashed. Rate-limit requests per email + IP.
- Deep link: `syntixpharma://reset-password?token=…` (configure the scheme in `app.json`).
