# P9 — Known limitations (honest)

As of P9.0–P9.11 core + P9.12 partial:

1. **P9.12 incomplete** — auth/smoke only ; production gates A–J, chaos, scale, full authenticated E2E not closed.
2. **No live provider adapters** — Prometheus / Alertmanager / Grafana / OTEL endpoints are registry rows only; status defaults to `NOT_CONFIGURED` → overview marks integrations `UNAVAILABLE`.
3. **Health snapshots** require trusted `sourceSystem` prefixes (`p7.|probe.|otel.|prometheus.|system.`) for `HEALTHY` — no fabricated green status.
4. **Automation execute** records durable execution + audit; it does **not** invoke external runtimes (no silent provider success).
5. **On-call** stores teams/rotations only — no paging / notification delivery tracking.
6. **Status publications** are internal SoD workflow; no public status-page CDN/publish adapter.
7. **Service catalog** remains a configured registry (P9.1), not auto-discovery from P7.
8. **Console UI** Operations Center is tabbed + API-bound ; deep workflows (full forms per domain) remain thin vs backend surface.
9. Migration `116` must be applied on control-plane DB before routes succeed against empty schema.
10. **No E3 Testcontainers suite** yet for `116_edge_p9_operations_core.sql` (optional follow-up).
