ALTER TABLE organizations DROP CONSTRAINT organizations_plan_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_plan_check CHECK(plan IN ('starter','business','premium'));
ALTER TABLE organizations ADD COLUMN modules text[] NOT NULL DEFAULT ARRAY['flow','academy','assist','insights'];
ALTER TABLE organizations ADD COLUMN first_paid_at timestamptz;
ALTER TABLE organizations ADD COLUMN settings jsonb NOT NULL DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN stripe_event_at bigint NOT NULL DEFAULT 0;
CREATE TABLE checkout_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 plan text NOT NULL CHECK(plan IN ('starter','business','premium')), modules text[] NOT NULL,
 amount_cents integer NOT NULL CHECK(amount_cents>0), discount_percent integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired','canceled')),
 provider text NOT NULL CHECK(provider IN ('local_test','stripe_test')), stripe_session_id text UNIQUE,
 customer_key text NOT NULL, expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes',
 created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz, UNIQUE(tenant_id,id)
);
-- Global campaign inventory is intentionally separate from tenant business data.
-- Runtime can transact reservations, but campaign rules can only be changed by the operator's migration role.
CREATE TABLE launch_campaign (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT true,
 capacity integer NOT NULL DEFAULT 20 CHECK(capacity BETWEEN 0 AND 100000),
 percent integer NOT NULL DEFAULT 20 CHECK(percent BETWEEN 1 AND 90), months integer NOT NULL DEFAULT 3 CHECK(months BETWEEN 1 AND 24),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO launch_campaign(id) VALUES(true);
CREATE TABLE launch_reservations (
 order_id uuid PRIMARY KEY REFERENCES checkout_orders(id) ON DELETE CASCADE,
 customer_key text NOT NULL, tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, redeemed_at timestamptz,
 percent integer NOT NULL, months integer NOT NULL
);
CREATE INDEX launch_reservation_capacity ON launch_reservations(expires_at) WHERE redeemed_at IS NULL;
CREATE UNIQUE INDEX launch_customer_redeemed ON launch_reservations(customer_key) WHERE redeemed_at IS NOT NULL;
CREATE TABLE paying_customers (customer_key text PRIMARY KEY, first_paid_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE custom_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name text NOT NULL, permissions text[] NOT NULL DEFAULT '{}', UNIQUE(tenant_id,id), UNIQUE(tenant_id,name)
);
ALTER TABLE memberships ADD COLUMN custom_role_id uuid;
ALTER TABLE memberships ADD CONSTRAINT membership_custom_role FOREIGN KEY(tenant_id,custom_role_id) REFERENCES custom_roles(tenant_id,id);
CREATE TABLE user_preferences (
 tenant_id uuid NOT NULL, user_id uuid NOT NULL, settings jsonb NOT NULL DEFAULT '{}',
 PRIMARY KEY(tenant_id,user_id), FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE CASCADE
);
CREATE TABLE documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 title text NOT NULL, filename text NOT NULL, mime text NOT NULL, bytes bytea NOT NULL, size_bytes integer NOT NULL,
 visibility text NOT NULL CHECK(visibility IN ('company','managers','team')), team_id uuid,
 uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,team_id) REFERENCES teams(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE learning_paths (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 title text NOT NULL, description text NOT NULL DEFAULT '', article_ids uuid[] NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id)
);
CREATE TABLE learning_progress (
 tenant_id uuid NOT NULL, path_id uuid NOT NULL, user_id uuid NOT NULL, article_id uuid NOT NULL, completed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,path_id,user_id,article_id), FOREIGN KEY(tenant_id,path_id) REFERENCES learning_paths(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE CASCADE, FOREIGN KEY(tenant_id,article_id) REFERENCES articles(tenant_id,id) ON DELETE CASCADE
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['checkout_orders','custom_roles','user_preferences','documents','learning_paths','learning_progress'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id::text = current_setting(''app.tenant_id'',true)) WITH CHECK (tenant_id::text = current_setting(''app.tenant_id'',true))',t);
 END LOOP;
END $$;
