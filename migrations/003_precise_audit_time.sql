-- Record event order accurately even when multiple mutations share a transaction.
ALTER TABLE audit_logs ALTER COLUMN created_at SET DEFAULT clock_timestamp();
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id);
CREATE INDEX IF NOT EXISTS comments_workflow_idx ON comments(tenant_id,workflow_id,created_at);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(tenant_id,user_id,created_at DESC);
