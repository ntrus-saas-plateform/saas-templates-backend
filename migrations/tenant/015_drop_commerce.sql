-- Migration 015: Drop commerce tables (commerce Nest module removed)

DROP TABLE IF EXISTS loyalty_transactions;
DROP TABLE IF EXISTS loyalty_accounts;
DROP TABLE IF EXISTS order_lines;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_lines;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS products;

INSERT INTO schema_migrations (version) VALUES ('015_drop_commerce') ON CONFLICT DO NOTHING;
