# 20 — Testing strategy

| Layer | Coverage |
|-------|----------|
| Domain vitest | `mrr-calculator`, metric registry, retention calculator, assurance detectors |
| Controller auth | Permission matrix spec |
| FE vitest | `edge-revenue-module.test.tsx` — UNAVAILABLE empty state, badges, publish |
| Playwright smoke | Sign-in gate + CSRF reject on mutating revenue routes |

Deferred: Testcontainers concurrency, live P6 recognition e2e, authenticated Playwright deep scenarios.
