# Backend spec — OTP verification (Screen 21)

Step 2/3: verify the phone with a 6-digit code sent during sign-up (Screen 20).
Client is **mock-first** — any 6-digit code passes except `000000` (which demos the
error state). Verify → Permissions (Screen 23).

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## POST `/auth/verify-otp`

Public. Confirms the code and **activates** the pending account.

**Body**
```jsonc
{ "signupToken": "<from /auth/register>", "code": "624810" }
```

**200 Response `data`**
```jsonc
{
  "user":   { "id": "usr_...", "email": "...", "name": "Camille" },
  "tokens": { "accessToken": "<jwt>", "refreshToken": "<opaque>" }
}
```
→ client persists the session (`authStore.setUser`) and continues to Permissions.

**Errors**
| status | case | client behavior |
|---|---|---|
| `400` | wrong code | red boxes + toast `otp.invalidCode` |
| `410` | code expired | toast + prompt to resend |
| `429` | too many attempts | lock input, surface retry-after |

---

## POST `/auth/resend-otp`

Public. Re-issues a code; rate-limited. Client enforces a **30s** countdown before the
"Renvoyer" link is tappable.

**Body** `{ "signupToken" }` → **`data`** `{ "resendIn": 30 }`.

---

## POST `/auth/otp/channel`  ("verify by email instead")

Public. Switches the OTP delivery channel to email (same `signupToken`).

**Body** `{ "signupToken", "channel": "email" }` → **`data`** `{ "resendIn": 30, "sentTo": "c•••@email.com" }`.

---

## Notes
- Codes are 6 digits, short TTL (e.g. 5 min), single-use; store hashed server-side.
- No `tenantId` — still platform-global onboarding.
- On success the account is active; the pending-account TTL from Screen 20 is cleared.
