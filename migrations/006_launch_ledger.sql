ALTER TABLE paying_customers ADD COLUMN launch_discount boolean NOT NULL DEFAULT false;
ALTER TABLE checkout_orders ADD COLUMN stripe_subscription_id text;
ALTER TABLE checkout_orders ADD COLUMN stripe_invoice_id text;
ALTER TABLE organizations ADD COLUMN discount_ends_at timestamptz;
ALTER TABLE organizations ADD COLUMN discount_percent integer NOT NULL DEFAULT 0;
