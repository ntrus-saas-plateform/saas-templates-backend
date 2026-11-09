# Plan management

Implementation status mirrors code under `src/modules/edge/**/commercial*` and migrations `075`/`076`.

## Source of truth
- Control Plane tables only (never tenant DBs)
- P1 products/capabilities remain SoT for technical objects
- Unknown market/price values stay unknown (no invented TAM/SAM/SOM or tariffs)

## Related APIs
See `24-api-reference.md` for the live `/api/v1/edge/commercial/**` surface.

## Notes
Document updated to match implemented behavior. Gaps vs full P2.19 console surface are tracked in `30-release-report.md`.
