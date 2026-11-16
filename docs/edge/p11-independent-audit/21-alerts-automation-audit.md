# 21 — Audit alerts & automation (P11)

| Champ | Valeur |
|-------|--------|
| Tables | `edge_revenue_business_alert_policies`, `edge_revenue_business_alerts` (+ legacy `edge_p11_business_alerts`) |
| Console | Onglet Alerts PRESENT |
| Verdict | Evaluate/ack **présent** ; automation enterprise **limitée** |

## Flux (E3)

- Create policy : `POST edge/business/alerts/policies` (`business:manage`)
- List : `GET edge/business/alerts` (`business:read`)
- Acknowledge : `POST .../acknowledge`
- Evaluate : `POST edge/business/alerts/evaluate`

Use-case evaluate : si snapshot manquant / UNAVAILABLE → alert **non inventée** (note dataQuality UNAVAILABLE) — doctrine honnête **PASS E3**.

## Gaps

| ID | Sévérité | Gap |
|----|----------|-----|
| F-P11-018 | P2 | Dual tables alerts 122 vs 123 |
| F-P11-032 | P2 | Pas de notification channels (email/Slack/pager) prouvés |
| F-P11-023 | P2 | Automation outbox/runtime E4 non validée cet audit |

## Verdict

Alerts MVP **OK**. Automation enterprise **FAIL**.
