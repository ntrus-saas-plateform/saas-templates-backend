# User Account

Self-service **User** account for staff on the platform shell.

Identity (Keycloak authentication) is documented separately in [IDENTITY.md](./IDENTITY.md).

## Surfaces

| Area | Layer | API | UI |
|------|-------|-----|----|
| Profile | User | `GET/PATCH /api/v1/users/me` | Settings → Profile |
| Preferences | User | `GET/PATCH /api/v1/users/me/preferences` | Settings → Preferences |
| Personalization | User | `GET/PATCH /api/v1/users/me/personalization` | Settings → Personalization |
| Memberships | Membership | `GET /api/v1/users/me/memberships` | Settings → Memberships |
| Identity (creds/MFA/IdP links) | Identity | `GET /api/v1/users/me/identity` | Settings → Identity & security |
| Notifications | User | `GET/POST /api/v1/users/me/notifications*` | Shell notification bell |
| Devices | User (+ Identity sessions) | `GET/PATCH/DELETE /api/v1/users/me/devices*` | Identity & security → Devices |
| Login history | User | `GET/POST /api/v1/users/me/login-history` | Identity & security → Login history |
| API tokens | User | `GET/POST/DELETE /api/v1/users/me/api-tokens*` | Identity & security → API tokens |
| Activity | User | `GET/POST/DELETE /api/v1/users/me/activity` | Shell activity center |
| Sessions | Identity | `GET/POST /api/v1/sessions*` | Identity & security → Sessions |
| Capabilities | Membership | `GET /api/v1/platform/me/capabilities` | Shell / PermissionGate |

## Profile (Phase 1)

Stored in control-plane `application_users.profile` (JSONB).

Personal / contact / professional fields are editable. Optional: `gender`, `dateOfBirth`.

`employment` on `GET /users/me` is a **read-only projection** from the current org membership (department, position, manager, roles, joinedAt).

## Preferences (Phase 1 + Phase 4 hydrate)

Stored in tenant DB `user_preferences.settings` (flat dotted keys).

Resolution for `GET /users/me/preferences`:

`user override → organization → tenant → platform default`

Shell `PreferencesApiHydrator` applies API values (locale, theme, density, sidebar, reducedMotion) into the USER localStorage base after platform boot. It skips keys already set in ephemeral `sessionOverrides` (§55). Effective shell display merges SESSION over USER via nested `PreferencesContext`.

See [CONFIGURATION.md](./CONFIGURATION.md) and [PREFERENCES.md](./PREFERENCES.md).

## Personalization (Phase 2 + Phase 4 shell sync)

Stored under `user_preferences.settings.personalization`.

`PersonalizationProvider` loads favorites/pins, tracks recent apps/pages on navigation, and App launcher stars sync favorites.

## Notifications inbox (Phase 2 + Phase 4)

Tenant table `user_notifications`. List / mark-read / mark-all / delete from the shell bell.

Successful **new** login records also create a `security` inbox item (“New sign-in”).

### Domain event producers (Phase 5)

With `RABBITMQ_CONSUMER_ENABLED=true`, `UserNotificationFanoutHandler` turns identity events into inbox rows:

| Event | Category |
|-------|----------|
| `membership.created/revoked/roles.updated.v1` | membership |
| `user.activated/suspended/disabled/reactivated.v1` | account / security |
| `platform.organization.switched.v1` | organization |
| `security.policy.updated.v1` | security (actor) |

Tenant setting `notifications.inAppEnabled` gates creation. When `notifications.pushEnabled` and `PUSH_DELIVERY_ENABLED=true` and the user has enrolled devices, the handler enqueues `notification.push.requested.v1` on the **tenant** outbox.

### Push delivery (Phase 5)

`NotificationPushHandler` delivers via `CompositePushNotificationAdapter` (FCM server key, Web Push VAPID + `web-push`, APNs stub/dry-run). Invalid tokens clear `user_devices` push columns.

## Soft devices (Phase 2) + push enrollment (Phase 3)

Tenant table `user_devices`. Sync from Keycloak sessions; enroll/clear push tokens for FCM / APNs / Web Push.

Shell: Devices tab can **Subscribe this browser** (Web Push via `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `/sw.js`) then enroll the JSON subscription, or paste a token manually.

## Security (Phase 1 — 2A + 2B)

Keycloak remains source of truth for passwords, OTP, WebAuthn. Platform lists/revokes credentials and sessions; enrollment uses Keycloak required actions + Account Console.

## Login history (Phase 3 + Phase 4)

`POST /users/me/login-history` on shell boot. Deduped by JWT `jti`, else `iat:subject`, else hourly subject key.

## Personal API tokens (Phase 3 + Phase 4 PAT auth)

Format: `uat_<tenantId>.<secret>` (SHA-256 stored). Create returns plaintext once.

**Bearer auth:** `AuthGuard` accepts `Authorization: Bearer uat_…` via `PatValidationService` (skips JWT/MFA). Host tenant must match when the hostname is registered. Non-empty scopes **intersect** membership permissions; empty scopes = full membership permissions. `last_used_at` is updated on each use.

## Activity feed (Phase 3 + Phase 4)

`user_activity_events` synced from shell `pushActivity` (org switch, sign-in, preferences save, push enroll, …). Surfaces: shell activity center + `/settings/activity`. Clear empties remote + local cache.

## Phases

| Phase | Scope |
|-------|--------|
| 1 | Profile, preferences, security/sessions, memberships API, capabilities |
| 2 | Personalization API, notification inbox, soft devices |
| 3 | Login history, API tokens CRUD, push enrollment, activity API |
| 4 | PAT Bearer auth, shell sync/hydrate, memberships UI, inbox/activity polish, login→notification producer |
| 5 | System notification fanout from domain events + push delivery worker |

See also [MESSAGING.md](./MESSAGING.md) for outbox / consumer wiring.
