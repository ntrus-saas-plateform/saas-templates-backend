-- P7.2 remediation: demote seeded deployment profiles from CERTIFIED to UNCERTIFIED.
-- Does NOT alter migration 096 schema/seed statements; corrects runtime seed state only.
--
-- Semantics (fail-closed compatibility engine):
--   available  ≠ documented ≠ validated ≠ certified
--   Seed profiles = AVAILABLE + DOCUMENTED only (discoverable in registry).
--   Certification requires evidence via an explicit certify flow — seed must not imply CERTIFIED.
--   ACTIVE profile_status keeps SHARED_SAAS / DEDICATED_DATA / DEDICATED_RUNTIME listed/usable
--   as documented registry entries, but UNCERTIFIED blocks PRODUCTION compatibility until certified.

UPDATE edge_p7_deployment_profiles
SET
  certification_status = 'UNCERTIFIED',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'seedTier', 'AVAILABLE_DOCUMENTED',
    'certified', false,
    'certificationRemediation', '097_edge_p7_deployment_profile_certification_remediation'
  ),
  updated_at = NOW(),
  updated_by = COALESCE(updated_by, 'system')
WHERE code IN ('SHARED_SAAS', 'DEDICATED_DATA', 'DEDICATED_RUNTIME')
  AND certification_status = 'CERTIFIED';

-- Keep ACTIVE for the three documented seed profiles (availability ≠ certification).
UPDATE edge_p7_deployment_profiles
SET profile_status = 'ACTIVE'
WHERE code IN ('SHARED_SAAS', 'DEDICATED_DATA', 'DEDICATED_RUNTIME')
  AND profile_status <> 'ACTIVE';

-- PRIVATE_CLOUD / ON_PREMISE remain UNCERTIFIED + DRAFT (no change required if already so).
UPDATE edge_p7_deployment_profiles
SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'seedTier', 'AVAILABLE_DOCUMENTED',
    'certified', false
  )
WHERE code IN ('PRIVATE_CLOUD', 'ON_PREMISE')
  AND (metadata->>'seedTier') IS DISTINCT FROM 'AVAILABLE_DOCUMENTED';
