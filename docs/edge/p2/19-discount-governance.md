# Discount governance

P2 stores **policies**, not opportunity-level discount requests (P4/P5).

## API
- `GET/POST /api/v1/edge/commercial/discount-policies`
- Permission: `platform:pricing:discounts:manage`

## Rules
- `maxPercentage` must be 0–100 when provided
- Approval matrix is caller-supplied JSON — **no invented delegation thresholds**
- Types: `PERCENTAGE`, `FIXED_AMOUNT`, `VOLUME`, `PROMOTIONAL`, `COMMITMENT`, `PARTNER`, `NEGOTIATED_ENTERPRISE`

Pricing protection (min price / max discount) is enforced when applying discounts in later sales workflows; preview math already supports percentage discounts without mutating price books.
