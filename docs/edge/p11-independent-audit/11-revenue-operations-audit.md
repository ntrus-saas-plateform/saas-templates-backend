# 11 — Audit revenue operations (P11)

| Champ | Valeur |
|-------|--------|
| Module | `application/revenue-operations/revenue.use-cases.ts` |
| Verdict | Ops API **larges** ; opérationnalisation console **étroite** |

## Capacités ops présentes (E3)

| Capacité | Endpoint / mécanisme | Console |
|----------|----------------------|---------|
| Overview métriques | GET `/edge/revenue/overview` | PRESENT |
| Compute MRR | POST `/edge/revenue/mrr/compute` | PARTIAL (via MRR tab) |
| Metrics CRUD-ish | definitions / publish / snapshots | PARTIAL |
| Retention | GET/POST retention | PRESENT |
| Renewals intelligence | GET renewals | PRESENT |
| Assurance scan | POST assurance/scan | PARTIAL (tab) |
| Leakage cases | POST + transition | API_ONLY / thin |
| Alerts evaluate/ack | business alerts | PRESENT |
| Reports generate | business reports | PRESENT |
| Audit events | GET/POST business/audit | API_ONLY |
| Targets | business targets | API_ONLY |

## Idempotency / outbox

Table `edge_p11_idempotency_keys` (122) ; use-cases émettent events (`revenue.events.ts`) — preuve E3 structurelle ; E4 runtime non validé cet audit ([F-P11-023](./34-findings-and-risk-register.md) P2).

## Verdict

Couche application **riche en endpoints**. Revenue operations enterprise (playbooks, SoD bout-en-bout, E2E) **non prouvée**.
