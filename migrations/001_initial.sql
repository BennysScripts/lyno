CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, name text NOT NULL,
 password_hash text NOT NULL, email_verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, industry text NOT NULL DEFAULT 'IT-Dienstleistung',
 size text NOT NULL DEFAULT '10–50', is_demo boolean NOT NULL DEFAULT false,
 plan text NOT NULL DEFAULT 'starter' CHECK(plan IN ('starter','business')), subscription_status text NOT NULL DEFAULT 'trialing' CHECK(subscription_status IN ('trialing','active','canceled','past_due')),
 trial_ends_at timestamptz NOT NULL DEFAULT now()+interval '14 days', period_ends_at timestamptz,
 cancel_at_period_end boolean NOT NULL DEFAULT false, stripe_customer_id text, stripe_subscription_id text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
 tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('owner','admin','manager','member','viewer')), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE sessions (
 id_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 tenant_id uuid REFERENCES organizations(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE auth_tokens (
 id_hash text PRIMARY KEY, user_id uuid REFERENCES users(id) ON DELETE CASCADE, purpose text NOT NULL CHECK(purpose IN ('verify','reset')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rate_limits (key text PRIMARY KEY, count integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL);
CREATE TABLE teams (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name text NOT NULL, UNIQUE(tenant_id,id), UNIQUE(tenant_id,name)
);
CREATE TABLE team_members (
 tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, team_id uuid NOT NULL, user_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,team_id,user_id), FOREIGN KEY(tenant_id,team_id) REFERENCES teams(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE CASCADE
);
CREATE TABLE invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 email text NOT NULL, role text NOT NULL CHECK(role IN ('admin','manager','member','viewer')), token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days', accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name text NOT NULL, UNIQUE(tenant_id,id), UNIQUE(tenant_id,name)
);
CREATE TABLE articles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 title text NOT NULL, body text NOT NULL, category_id uuid, visibility text NOT NULL DEFAULT 'company' CHECK(visibility IN ('company','managers','team')),
 team_id uuid, author_id uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,category_id) REFERENCES categories(tenant_id,id), FOREIGN KEY(tenant_id,team_id) REFERENCES teams(tenant_id,id),
 CHECK(visibility <> 'team' OR team_id IS NOT NULL)
);
CREATE TABLE templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name text NOT NULL, description text NOT NULL DEFAULT '', steps jsonb NOT NULL, fields jsonb NOT NULL DEFAULT '[]',
 recurrence_days integer CHECK(recurrence_days BETWEEN 1 AND 365), next_run_at timestamptz, active boolean NOT NULL DEFAULT true,
 created_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id)
);
CREATE TABLE workflows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 template_id uuid, name text NOT NULL, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','canceled')),
 priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')), form_data jsonb NOT NULL DEFAULT '{}',
 due_at timestamptz, created_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,template_id) REFERENCES templates(tenant_id,id)
);
CREATE TABLE tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 workflow_id uuid NOT NULL, title text NOT NULL, description text NOT NULL DEFAULT '', position integer NOT NULL,
 kind text NOT NULL CHECK(kind IN ('task','approval')), status text NOT NULL CHECK(status IN ('pending','ready','done','skipped','rejected')),
 assignee_id uuid, article_id uuid, due_at timestamptz, completed_at timestamptz, UNIQUE(tenant_id,id), UNIQUE(workflow_id,position),
 FOREIGN KEY(tenant_id,workflow_id) REFERENCES workflows(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,assignee_id) REFERENCES memberships(tenant_id,user_id), FOREIGN KEY(tenant_id,article_id) REFERENCES articles(tenant_id,id)
);
CREATE TABLE comments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, workflow_id uuid NOT NULL,
 user_id uuid REFERENCES users(id) ON DELETE SET NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,workflow_id) REFERENCES workflows(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE checklist_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, title text NOT NULL,
 article_id uuid, template_id uuid, UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,article_id) REFERENCES articles(tenant_id,id), FOREIGN KEY(tenant_id,template_id) REFERENCES templates(tenant_id,id)
);
CREATE TABLE checklist_completions (
 tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, item_id uuid NOT NULL, user_id uuid NOT NULL,
 completed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,item_id,user_id),
 FOREIGN KEY(tenant_id,item_id) REFERENCES checklist_items(tenant_id,id) ON DELETE CASCADE, FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE CASCADE
);
CREATE TABLE notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id uuid NOT NULL,
 title text NOT NULL, href text NOT NULL DEFAULT '/app', read_at timestamptz, dedupe_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE CASCADE
);
CREATE TABLE audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL, entity_id text, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE assist_usage (
 tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, day date NOT NULL DEFAULT current_date, count integer NOT NULL DEFAULT 0, PRIMARY KEY(tenant_id,day)
);
CREATE TABLE billing_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 event_key text UNIQUE NOT NULL, kind text NOT NULL, plan text NOT NULL, amount_cents integer NOT NULL, mode text NOT NULL DEFAULT 'test' CHECK(mode='test'), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE webhook_events (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE waitlist (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL, company text NOT NULL, marketing_consent boolean NOT NULL DEFAULT false,
 consent_version text NOT NULL DEFAULT 'beta-2026-10', token_hash text NOT NULL, expires_at timestamptz NOT NULL DEFAULT now()+interval '2 days',
 confirmed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE contact_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, name text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX workflows_tenant_created ON workflows(tenant_id,created_at);
CREATE INDEX tasks_tenant_status ON tasks(tenant_id,status,due_at);
CREATE INDEX audit_tenant_created ON audit_logs(tenant_id,created_at DESC);
CREATE INDEX articles_search ON articles USING gin(to_tsvector('german', title || ' ' || body));
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['teams','team_members','invitations','categories','articles','templates','workflows','tasks','comments','checklist_items','checklist_completions','notifications','audit_logs','assist_usage','billing_events'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab);
 END LOOP;
END $$;
