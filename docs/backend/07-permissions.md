# Backend spec — Permissions (Screen 23)

Post-signup OS permission priming: location, notifications, camera. This is almost
entirely **client + OS**, not backend. The only server touchpoint is registering the
push token once notifications are granted.

Client is **mock-first**: statuses are hard-set to match the design (location +
notifications granted, camera denied) and real OS requests are deferred to avoid a
native rebuild (see [[env-disk-constraint]] — expo-location/notifications/camera).

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## Client-only (no endpoint)

| permission | module (when wired) | used for |
|---|---|---|
| location | `expo-location` | nearby-pharmacy search & map (Screens 10–12) |
| notifications | `expo-notifications` | dose reminders + order status |
| camera | `expo-camera` | scan prescriptions & barcodes |

- Denied camera → inline explainer + **"Enable in Settings"** → `Linking.openSettings()`.
- Continue is always enabled (permissions are optional) → Home `/(tabs)`.

---

## POST `/notifications/register-token`  (only after notifications granted)

Requires auth. Registers the Expo push token for this device/user.

**Body**
```jsonc
{
  "expoPushToken": "ExponentPushToken[…]",
  "platform": "ios" | "android",
  "deviceId": "<stable device id>"
}
```
**200 Response `data`** `{ "registered": true }`

---

## Notes
- `tenantId` **not** set here — notifications are user-scoped globally; pharmacy-scoped
  order events resolve tenant server-side from the order, not the device token.
- Re-register the token on app updates / token rotation; de-register on logout.
- This screen ends Section A onboarding — Continue lands the user on Home.
