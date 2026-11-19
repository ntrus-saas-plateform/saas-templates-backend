-- Migration 147: restrictions JSONB sur edge_commercial_addon_capabilities
-- Alignement avec plan (075 L249) et package (075 L210) : mêmes quotas
-- (ex. numericLimit) gérables sur add-ons par le MÊME mécanisme (doc 39 W4).

ALTER TABLE edge_commercial_addon_capabilities
  ADD COLUMN IF NOT EXISTS restrictions JSONB NOT NULL DEFAULT '{}'::jsonb;
