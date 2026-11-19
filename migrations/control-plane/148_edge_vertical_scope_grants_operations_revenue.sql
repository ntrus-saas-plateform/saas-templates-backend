-- Migration 148: liens de scope verticale pour isolation verticale stricte
-- (gap 2/3 du plan d'alignement) :
--   1. edge_sales_visibility_grants.vertical_id  -> grants visibilité par verticale
--   2. edge_p9_services.vertical_id              -> services control-plane Sante & Operations
--      (alertes/incidents/changes/maintenance lies aux services via service_id)
--   3. edge_p11_revenue_forecasts.vertical_id    -> forecasts revenus par verticale
--   4. edge_p11_revenue_cohorts.vertical_id      -> cohortes retention (GRR/NRR) par verticale
-- Mode hybride: NULL = plateforme globale, renseigne = scope vertical strict.

ALTER TABLE edge_sales_visibility_grants
  ADD COLUMN IF NOT EXISTS vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_edge_sales_visibility_grants_vertical
  ON edge_sales_visibility_grants (vertical_id);

ALTER TABLE edge_p9_services
  ADD COLUMN IF NOT EXISTS vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_edge_p9_services_vertical
  ON edge_p9_services (vertical_id);

ALTER TABLE edge_p11_revenue_forecasts
  ADD COLUMN IF NOT EXISTS vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_edge_p11_revenue_forecasts_vertical
  ON edge_p11_revenue_forecasts (vertical_id);

ALTER TABLE edge_p11_revenue_cohorts
  ADD COLUMN IF NOT EXISTS vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_edge_p11_revenue_cohorts_vertical
  ON edge_p11_revenue_cohorts (vertical_id);
