-- Migration 046: WhatsApp campaign delivery fields (no SMS)

ALTER TABLE crm_campaign_audience_members
  ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_crm_campaign_audience_status
  ON crm_campaign_audience_members (organization_id, campaign_id, status);

-- Discourage SMS at the DB comment level (app enforces rejection)
COMMENT ON COLUMN crm_campaigns.channel IS
  'EMAIL | WHATSAPP | IN_APP | PUSH — SMS not supported';

INSERT INTO schema_migrations (version) VALUES ('046_crm_whatsapp_campaign_delivery')
ON CONFLICT DO NOTHING;
