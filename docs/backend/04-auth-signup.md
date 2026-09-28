# Backend spec — Sign up + GDPR (Screen 20)

Step 1/3 of registration: collect identity + GDPR consents, then send a phone OTP
(Screen 21) before the account is fully active. Client is **mock-first** (no network
call yet — Continue just navigates to OTP carrying the phone).

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## POST `/auth/register`

Public. Creates a **pending** account and dispatches an OTP to the phone.

**Body**
```jsonc
{
  "firstName": "Camille",
  "lastName": "Martin",
  "email": "camille.martin@email.com",
  "phone": "+33612345678",
  "password": "••••••••",
  "consents": {
    "tos": true,        // mandatory — Terms + Privacy
    "health": true,     // mandatory — GDPR health-data processing
    "marketing": false  // optional
  }
}
```

**201 Response `data`**
```jsonc
{
  "signupToken": "<opaque>",     // short-lived; passed to OTP verify (Screen 21)
  "phoneMasked": "+33 6 •• •• •• 78",
  "resendIn": 30                 // seconds until OTP resend allowed
}
```

**Errors**
| status | case | client behavior |
|---|---|---|
| `400` | validation failed | inline field errors (client validates first via zod) |
| `409` | email or phone already registered | field error / toast |
| `422` | mandatory consent missing | blocked client-side (CTA disabled until tos+health) |

**Client rules**
- zod validation: names ≥ 2, valid email, phone ≥ 6, password ≥ 8 (`validation.*` i18n).
- **CTA disabled** until both mandatory consents (`tos`, `health`) are checked.
- Persist consent **timestamp + policy version** server-side for GDPR audit.
- Store the raw password only transiently; hash server-side (argon2/bcrypt).

---

## Notes
- No `tenantId` — the consumer account is platform-global.
- On success → Screen 21 OTP with `signupToken` + `phoneMasked`. Account activates only
  after OTP verification; unverified pending accounts expire (e.g. 24h TTL).
- Marketing consent drives the `/analytics` + email opt-in; must default **off**.
