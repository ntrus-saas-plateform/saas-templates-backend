# P7.4 — Human tasks & approvals

Types: `APPROVAL|REVIEW|MANUAL_ACTION|EXCEPTION_RESOLUTION|COMPENSATION_INTERVENTION`.

Lifecycle: `OPEN→ASSIGNED→IN_PROGRESS→APPROVED|REJECTED|COMPLETED` (or `EXPIRED|CANCELLED`). Terminal decisions are immutable.

RBAC (099): SUPER_ADMIN all workflow*; OPERATOR read + pause/resume/cancel/retry + task ops + definition read (not publish/manage/worker/reconcile).
