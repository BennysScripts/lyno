CREATE TABLE mail_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payload text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent','failed')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
 last_error text CHECK(last_error IN ('delivery_failed'))
);
CREATE INDEX mail_outbox_pending_idx ON mail_outbox(available_at) WHERE status='queued';
