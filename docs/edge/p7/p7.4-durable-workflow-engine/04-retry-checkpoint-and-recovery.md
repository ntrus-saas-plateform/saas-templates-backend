# P7.4 — Retry, checkpoint & recovery

Exponential backoff with deterministic jitter (`computeBackoffMs`). Never auto-retry `PERMANENT` / `AUTHORIZATION_REVOKED` / `VALIDATION` / `CONFLICT`.

Attempts append-only; checkpoints sequenced with integrity hash; exhausted work → dead letters (`OPEN|RESOLVED`).
