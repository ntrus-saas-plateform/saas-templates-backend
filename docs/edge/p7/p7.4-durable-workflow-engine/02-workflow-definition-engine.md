# P7.4 — Workflow definition engine

`validateDefinition` rejects cycles, missing refs, unknown handlers/compensation keys, invalid retry/timeouts, unsupported expression ops.

Expression whitelist only: `eq` | `neq` | `exists` | `in` — no JS/SQL/shell eval.

Published versions are immutable snapshots in `edge_p7_workflow_definition_versions`.
