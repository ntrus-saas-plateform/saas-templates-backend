import { SETTING_DEFINITIONS } from './setting-definition.js';

export const PLATFORM_DEFAULTS: Readonly<Record<string, unknown>> = Object.freeze(
  Object.fromEntries(
    Object.entries(SETTING_DEFINITIONS).map(([fullKey, def]) => [fullKey, def.default]),
  ),
);

export const OVERRIDEABLE_ORG_SETTINGS: ReadonlySet<string> = new Set(
  Object.entries(SETTING_DEFINITIONS)
    .filter(([, def]) => def.overrideable)
    .map(([fullKey]) => fullKey),
);
