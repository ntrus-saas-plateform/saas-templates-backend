-- Wipe industry profiles and the tables that existed only for them.
-- Core commerce (sales, inventory, POS, catalog, CRM) stays.

UPDATE tenant_business_configurations SET profile_code = NULL WHERE profile_code IS NOT NULL;
UPDATE business_profiles SET base_profile_code = NULL WHERE base_profile_code IS NOT NULL;
DELETE FROM business_profile_versions;
DELETE FROM business_profiles;

DELETE FROM org_pack_subscriptions
WHERE pack_code IN (
  'CLINIC_CORE', 'HOSPITAL_CORE', 'HOTEL_CORE',
  'REG_CONTROLLED_SUBSTANCES', 'REG_COLD_CHAIN_GDP'
);
DELETE FROM licensing_packs
WHERE code IN (
  'CLINIC_CORE', 'HOSPITAL_CORE', 'HOTEL_CORE',
  'REG_CONTROLLED_SUBSTANCES', 'REG_COLD_CHAIN_GDP'
);

DELETE FROM product_vertical_extensions
WHERE vertical_code IN (
  'PHARMACY', 'RESTAURANT', 'BOOKSTORE', 'STATIONERY', 'COSMETICS_RETAIL', 'BOUTIQUE', 'FASHION'
);
DELETE FROM vertical_extension_definitions
WHERE vertical_code IN (
  'PHARMACY', 'RESTAURANT', 'BOOKSTORE', 'STATIONERY', 'COSMETICS_RETAIL', 'BOUTIQUE', 'FASHION'
);

DELETE FROM capability_definitions
WHERE code IN (
  'BOOKSTORE', 'BOOK_CATALOG', 'ISBN', 'STATIONERY',
  'BOOK_EDITION', 'BOOK_AUTHOR', 'BOOK_PUBLISHER', 'BOOK_LANGUAGE', 'BOOK_GENRE',
  'BOOK_FORMAT', 'BOOK_SERIES', 'BOOK_COLLECTION', 'BOOK_METADATA',
  'SCHOOL_SUPPLIES', 'OFFICE_SUPPLIES', 'PAPER_PRODUCTS', 'WRITING_INSTRUMENTS',
  'NOTEBOOKS', 'BINDERS', 'FILING_PRODUCTS', 'DESK_ACCESSORIES', 'ART_SUPPLIES',
  'COSMETICS_RETAIL', 'COSMETIC_PRODUCT', 'COSMETIC_PRODUCT_ATTRIBUTES', 'COSMETIC_BRAND',
  'COSMETIC_CATEGORY', 'COSMETIC_VARIANTS', 'SHADE_MANAGEMENT', 'COLOR_MANAGEMENT',
  'SIZE_MANAGEMENT', 'FRAGRANCE_MANAGEMENT', 'COSMETIC_ATTRIBUTES',
  'FASHION_RETAIL', 'APPAREL_RETAIL', 'STYLE_MANAGEMENT', 'FASHION_SIZE_MANAGEMENT',
  'FASHION_COLOR_MANAGEMENT', 'FIT_MANAGEMENT', 'MATERIAL_MANAGEMENT',
  'COLLECTION_MANAGEMENT', 'SEASON_MANAGEMENT', 'FASHION_PRODUCT_ATTRIBUTES',
  'FASHION_PRODUCT_VARIANTS', 'FASHION_SKU_MATRIX', 'SIZE_CURVE_ANALYSIS',
  'ASSORTMENT_MANAGEMENT', 'MARKDOWN_MANAGEMENT', 'CLEARANCE_MANAGEMENT',
  'OUTFIT_MANAGEMENT', 'LOOK_MANAGEMENT', 'TARGET_SEGMENT', 'FASHION_PREFERENCES',
  'CUSTOMER_SIZE_PROFILE', 'WISHLIST',
  'PRESCRIPTION', 'DISPENSING', 'CONTROLLED_PRODUCTS', 'INSURANCE',
  'RECIPES', 'INGREDIENTS', 'KITCHEN', 'TABLES', 'WASTE',
  'PMS', 'ROOM_SERVICE', 'HOUSEKEEPING', 'MINIBAR',
  'ADMISSIONS', 'CLINICAL_ORDERS', 'BEDS', 'REGULATORY_AUDIT'
);

DROP TABLE IF EXISTS
  fashion_bulk_operations,
  fashion_supplier_refs,
  fashion_reservations,
  fashion_wishlists,
  fashion_customer_profiles,
  fashion_outfits,
  fashion_product_lifecycles,
  fashion_collection_products,
  fashion_colors,
  fashion_size_conversions,
  fashion_size_curves,
  fashion_markdowns,
  fashion_assortments,
  fashion_size_systems,
  fashion_seasons,
  fashion_collections,
  product_isbn_index,
  pharmacy_batch_order_components,
  pharmacy_stability_timepoints,
  pharmacy_stability_studies,
  pharmacy_maintenance_work_orders,
  pharmacy_equipment_assets,
  pharmacy_batch_orders,
  pharmacy_regulatory_profiles,
  pharmacy_approval_requests,
  pharmacy_medication_adherence,
  pharmacy_pos_sessions,
  pharmacy_medication_returns,
  pharmacy_supplier_extensions,
  pharmacy_safety_cases,
  pharmacy_safety_signals,
  pharmacy_expiration_lot_snapshots,
  pharmacy_recall_notifications,
  pharmacy_calibration_records,
  pharmacy_temperature_devices,
  pharmacy_cold_chain_profiles,
  pharmacy_pregnancy_category_rules,
  pharmacy_dose_limit_rules,
  pharmacy_contraindication_rules,
  pharmacy_idempotency_keys,
  pharmacy_offline_operations,
  pharmacy_kpi_snapshots,
  pharmacy_medication_errors,
  pharmacy_adverse_events,
  pharmacy_refill_schedules,
  pharmacy_chronic_treatments,
  pharmacy_substitution_decisions,
  pharmacy_cold_excursions,
  pharmacy_cold_readings,
  pharmacy_recall_affected_dispensings,
  pharmacy_recall_lots,
  pharmacy_recall_notices,
  pharmacy_controlled_recon_discrepancies,
  pharmacy_controlled_transactions,
  pharmacy_controlled_register,
  pharmacy_drug_interaction_rules,
  pharmacy_dispensing_lines,
  pharmacy_dispensings,
  pharmacy_clinical_overrides,
  pharmacy_clinical_safety_findings,
  pharmacy_clinical_safety_checks,
  pharmacy_prescription_status_history,
  pharmacy_prescription_lines,
  pharmacy_prescriptions,
  pharmacy_prescribers,
  pharmacy_locations,
  insurance_reconciliation_discrepancies,
  insurance_claim_attachments,
  insurance_payer_receivables,
  insurance_limit_ledgers,
  insurance_tariffs,
  insurance_network_providers,
  insurance_provider_networks,
  insurance_contracts,
  insurance_claim_appeals,
  insurance_claim_denials,
  insurance_claim_adjudications,
  insurance_claim_submissions,
  insurance_authorizations,
  insurance_eligibility_requests,
  insurance_memberships,
  insurance_policies,
  insurance_plans,
  insurance_providers,
  insurance_claim_lines,
  insurance_claims,
  insurance_coverages,
  insurance_payers,
  kitchen_ticket_items,
  kitchen_tickets,
  dining_tables,
  hotel_folio_charges,
  hotel_stays,
  hotel_rooms,
  hotel_room_types
CASCADE;
