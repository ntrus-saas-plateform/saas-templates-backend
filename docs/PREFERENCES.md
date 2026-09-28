# User Preferences

## Storage

Tenant database table `user_preferences` (keyed by application `user_id` = Keycloak `sub`).

Columns:

- `active_organization_id` — UX hint only (not auth context; see [ORGANIZATION-ARCHITECTURE.md](./ORGANIZATION-ARCHITECTURE.md))
- `settings` JSONB — flat dotted preference keys (Phase 1) plus nested `personalization` (Phase 2)

## API

- `GET /api/v1/users/me/preferences` — resolved map (user + org + tenant + defaults)
- `PATCH /api/v1/users/me/preferences` — body `{ "settings": { "localization.locale": "fr", ... } }`
- `GET/PATCH /api/v1/users/me/personalization` — dedicated read/write for the `personalization` blob

Validated keys live in `src/modules/identity/domain/user/user-preferences.schema.ts`.
Personalization shape: `src/modules/identity/domain/user/user-personalization.ts`.

## Resolution chain

For configuration keys (locale, timezone, theme, …), see [CONFIGURATION.md](./CONFIGURATION.md):

`sessionOverrides → user override → organization override → tenant setting → platform default`

User overrides are the `settings` map loaded into `ConfigurationContext.userSettings`.
Session overlays are ephemeral (shell `sessionStorage` / request `sessionOverrides`) and never written into `user_preferences`.

Shell hydrate: after authenticated bootstrap, `PreferencesApiHydrator` (inside `SessionContextProvider`) copies resolved UI keys into the USER `PreferencesProvider` (locale, theme, density, sidebar, reducedMotion). Keys already present in `sessionOverrides` are skipped so SESSION (§55) is not overwritten. DOM `lang` / theme / density are applied from the merged session+user context.
