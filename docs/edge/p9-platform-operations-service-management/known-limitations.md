# P9 — Known limitations (honest)

As of P9.0/P9.1 kickoff:

1. **P9.2–P9.12 not implemented** — alerts, incidents, SLO, on-call, etc.
2. Overview dashboard does **not** claim live health — `UNAVAILABLE` for incidents/alerts.
3. No provider adapters (Prometheus/Alertmanager/Grafana) yet.
4. No E2E P9 scenarios executed yet beyond unit/auth for catalog.
5. Service catalog is **configured registry**, not auto-discovery from P7.
6. Notifications / on-call delivery tracking not wired.
7. Status page / public communications not started.
