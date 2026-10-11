ALTER TABLE checkout_orders ADD COLUMN checkout_url text;
ALTER TABLE checkout_orders ADD COLUMN discount_months integer NOT NULL DEFAULT 0;
ALTER TABLE checkout_orders ADD COLUMN stripe_price_id text;
