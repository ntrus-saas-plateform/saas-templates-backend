# CRM Ops Runbook (Wave 1)

## Migrate

```bash
pnpm migrate:control   # 060_crm_permissions
pnpm migrate:tenant <tenantId>  # 043_crm_engine_v1 (+ 044–046 as needed)
```

## Broker down

CRM engine mutations enqueue via `OutboxTransactionService`. Events stay PENDING until publisher recovers.

## Timeline lag

Projection is async via inbox consumer. If lag spikes, check RabbitMQ consumer + `customer_timeline_events` insert errors. Replays are safe when `source_event_id` unique (migration `007`).

## Merge incidents

Merge requires `customers:merge` / `crm:merge`, capability CRM, and same tenant+org. Audit `customer.merged.v1`. Cross-tenant merge is hard-denied in `assertCustomerMergeAllowed`.

## Campaign sends (WhatsApp — no SMS)

1. Create campaign with `channel: WHATSAPP` (SMS is rejected at domain boundary).
2. Queue audience: `POST /crm/campaigns/:id/audience` with `recipientPhone` in E.164 (+…). Frequency / opt-out / quiet-period still apply.
3. Transition to `RUNNING` → auto-dispatches QUEUED WhatsApp members via `WHATSAPP_CAMPAIGN_CHANNEL_PORT`.
4. Retry / resume: `POST /crm/campaigns/:id/dispatch-whatsapp`.

**Providers:** `WHATSAPP_PROVIDER=noop` (default, tests/local) or `meta` (Cloud API using `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`). Optional template: `WHATSAPP_CAMPAIGN_TEMPLATE_NAME`.

Failed provider delivery marks audience `FAILED` + outbox `crm.campaign.message.failed.v1` — CRM SoT is not corrupted. Email remains a separate channel; **SMS is not supported**.

## Loyalty

Point mutations stay on `/loyalty` and MCP loyalty tools. CRM 360 may **read** balance; it never double-writes points.
