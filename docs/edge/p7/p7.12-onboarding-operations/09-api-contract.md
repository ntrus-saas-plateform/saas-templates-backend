# P7.12 — API Contract

Base: `EdgeOnboardingController` under `@EdgeRoute()`.

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/onboarding/templates` | read |
| GET | `/edge/onboarding/templates/:id` | read |
| POST | `/edge/onboarding/templates` | start (create DRAFT) |
| POST | `/edge/onboarding/templates/:id/publish` | start |
| GET | `/edge/onboarding/journeys` | read |
| GET | `/edge/onboarding/journeys/:id` | read → `{ journey, steps, tasks, runs, evidence }` |
| POST | `/edge/onboarding/journeys` | start (create from ACTIVE activation) |
| POST | `/edge/onboarding/journeys/:id/start` | start → `p712.onboarding.start` |
| POST | `/edge/onboarding/journeys/:id/advance` | advance → `p712.onboarding.advance` |
| POST | `/edge/onboarding/journeys/:id/close` | close → requires all required steps PASSED |
| POST | `/edge/onboarding/journeys/:journeyId/tasks/:taskId/decide` | approve → APPROVE/REJECT (P7.1 first) |
| GET | `/edge/onboarding/journeys/:id/runs` | history:read |
| GET | `/edge/onboarding/journeys/:id/evidence` | history:read |

Console: `/edge/provisioning/onboarding`. Client: `edgeApi.listOnboardingJourneys` / `startOnboardingJourney` / `decideOnboardingTask` / … (`types/edge-onboarding.ts`).
