-- Stage 2 Initial Core Schema Purpose
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_type') THEN
    CREATE TYPE client_type AS ENUM ('photo', 'studio_renter', 'both');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_channel') THEN
    CREATE TYPE activity_channel AS ENUM ('email', 'sms', 'note', 'system');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_direction') THEN
    CREATE TYPE activity_direction AS ENUM ('inbound', 'outbound', 'internal', 'system');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_scope') THEN
    CREATE TYPE task_scope AS ENUM ('standalone', 'session', 'studio_booking', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('todo', 'doing', 'waiting_client', 'waiting_vendor', 'blocked', 'done');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY,
  client_type client_type NOT NULL,
  primary_name text NOT NULL,
  partner_name text,
  business_name text,
  email text,
  secondary_email text,
  phone text,
  mailing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  referral_source text,
  how_we_met text,
  lifetime_value_cents integer NOT NULL DEFAULT 0,
  first_booked_at timestamptz,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  vip boolean NOT NULL DEFAULT false,
  blocked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS clients_primary_name_idx ON clients (primary_name);
CREATE INDEX IF NOT EXISTS clients_email_idx ON clients (email);
CREATE INDEX IF NOT EXISTS clients_phone_idx ON clients (phone);
CREATE INDEX IF NOT EXISTS clients_search_trgm_idx ON clients USING GIN (
  lower(
    coalesce(primary_name, '') || ' ' ||
    coalesce(partner_name, '') || ' ' ||
    coalesce(business_name, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce(phone, '')
  ) gin_trgm_ops
);

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY,
  client_id uuid REFERENCES clients(id),
  scope_type varchar(80) NOT NULL,
  scope_id uuid,
  channel activity_channel NOT NULL,
  direction activity_direction NOT NULL,
  activity_type varchar(120) NOT NULL,
  subject text,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_message_id text,
  in_reply_to text,
  occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS activities_client_occurred_idx ON activities (client_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS activities_scope_idx ON activities (scope_type, scope_id);
CREATE INDEX IF NOT EXISTS activities_external_message_id_idx ON activities (external_message_id);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY,
  scope task_scope NOT NULL,
  scope_id uuid,
  title text NOT NULL,
  description text,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_at timestamptz,
  actual_done_at timestamptz,
  blocked_reason text,
  recurring_rule varchar(512),
  notes text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS tasks_status_due_at_idx ON tasks (status, due_at);
CREATE INDEX IF NOT EXISTS tasks_scope_idx ON tasks (scope, scope_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid NOT NULL,
  entity_type varchar(120) NOT NULL,
  entity_id uuid NOT NULL,
  action varchar(120) NOT NULL,
  actor varchar(160) NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (logged_at, id)
) PARTITION BY RANGE (logged_at);

CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity_type, entity_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor, logged_at DESC);
