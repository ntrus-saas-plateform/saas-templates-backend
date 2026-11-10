# P4 — Frontend Sales Console

**Route:** `/edge/sales`  
**Shell nav:** Sales  
**API client:** `lib/api/edge.ts` (P4 Sales block)

## Tabs

Overview · Accounts · Contacts · Lead Inbox · Opportunities · Pipeline · Activities · Quotes · Deal Desk · Contracts · Orders · Performance · Teams · Tasks

Permissions gate each tab via `EdgePermissionGate` / `hasEdgePermission`.

## Opportunity workspace data

`GET /edge/sales/opportunities/:id` returns a `workspace` bundle (assessments, offers, quotes, proposals, contracts, activities, closeReadiness). Dedicated full-page workspace polish is L-05.

## Honesty UX

- Performance / forecast show disclaimer: projections ≠ recognized revenue.
- Handoff button does not claim tenant creation.
- Contract EXECUTED path is server-enforced.
