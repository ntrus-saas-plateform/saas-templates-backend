# P5 � Frontend Subscription Console

**Date:** 2026-11-09  
**Status:** **IMPLEMENTED**

## Routes

| Route | Purpose |
|-------|---------|
| `/edge/subscriptions` | Hub (overview, registry, renewals, trials, entitlements, coordination, analytics) |
| `/edge/subscriptions/[id]` | Workspace (gates, items, entitlements, timeline, lifecycle actions) |

## Nav

`components/edge/edge-shell.tsx` ? **Subscriptions**

## API client

`lib/api/edge.ts` � `// --- P5 Subscriptions ---`

## E2E

| Script | Spec |
|--------|------|
| `npm run test:e2e:subscriptions` | smoke + scenarios (CSRF) |
| `npm run test:e2e:subscriptions:auth` | authenticated UI (needs `EDGE_E2E_AUTH=1`) |

Honesty: activation UI surfaces commercial / provisioning / billing gates; no payment collection UI.
