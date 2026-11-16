# P7.11 — API Contract

Base: `EdgeLifecycleController` under `@EdgeRoute()`.

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/lifecycle/records` | read |
| GET | `/edge/lifecycle/records/:id` | read → `{ record, runs, evidence }` |
| POST | `/edge/lifecycle/records` | suspend (create only) |
| POST | `/edge/lifecycle/records/:id/suspend` | suspend → `p711.lifecycle.suspend` |
| POST | `/edge/lifecycle/records/:id/resume` | resume → `p711.lifecycle.resume` |
| POST | `/edge/lifecycle/records/:id/deprovision` | deprovision → requires `authorized===true && confirmed===true && reason` |
| GET | `/edge/lifecycle/records/:id/runs` | history:read |
| GET | `/edge/lifecycle/records/:id/evidence` | history:read |

Create body: `activationRecordId` (+ optional retention/export/metadata).  
Deprovision body: **required** `authorized`, `confirmed`, `reason`.

Console: `/edge/provisioning/lifecycle`. Client: `edgeApi.listLifecycleRecords` / `suspendLifecycleRecord` / `deprovisionLifecycleRecord` / … (`types/edge-lifecycle.ts`).
