CREATE TABLE billing_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL CHECK(action IN ('subscribe','cancel','resume','abandon')),
 payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','succeeded','attention')),
 attempts integer NOT NULL DEFAULT 0, lease_token uuid, lease_until timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(tenant_id,id)
);
CREATE UNIQUE INDEX billing_operation_active ON billing_operations(tenant_id) WHERE status<>'succeeded';
CREATE INDEX billing_operation_due ON billing_operations(next_attempt_at) WHERE status IN ('pending','processing');
ALTER TABLE billing_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_operations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON billing_operations USING (tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK (tenant_id::text=current_setting('app.tenant_id',true));
ALTER TABLE organizations ADD COLUMN billing_checked_at timestamptz;
ALTER TABLE organizations ADD COLUMN billing_check_error text;
