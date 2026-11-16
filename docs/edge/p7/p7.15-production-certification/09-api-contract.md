# P7.15 — API Contract

Base: Edge authenticated routes under `/edge/certification/*`.

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/certification/packages` | read |
| GET | `/edge/certification/packages/:id` | read (detail + items + runs + evidence) |
| POST | `/edge/certification/packages` | manage |
| POST | `/edge/certification/packages/:id/assemble` | manage → `p715.certification.assemble` |
| POST | `/edge/certification/packages/:id/certify` | certify → `p715.certification.certify` |
| POST | `/edge/certification/packages/:id/revoke` | revoke → `p715.certification.revoke` |
| POST | `/edge/certification/packages/:id/evidence` | manage (attach/upsert item) |
| GET | `/edge/certification/packages/:id/evidence` | history:read |
| GET | `/edge/certification/packages/:id/evidence-items` | read |
| GET | `/edge/certification/packages/:id/runs` | history:read |
| GET | `/edge/certification/history` | history:read |
