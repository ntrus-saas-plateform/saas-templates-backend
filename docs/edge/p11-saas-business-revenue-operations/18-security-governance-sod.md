# 18 — Security, governance & SoD

- Edge auth + permission guards on all routes
- Metrics manage ≠ revenue approve ≠ commission approve (separate codes)
- Forecast approve / commission approve reserved for SoD (UI deferred)
- CSRF required on mutating BFF calls (FE e2e asserts CSRF_REJECTED)
- No tenant IAM or end-user management from P11
