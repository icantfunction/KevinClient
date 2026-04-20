-- Stage 10 Admin PWA Schema Purpose
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY,
  scope varchar(32) NOT NULL,
  scope_id uuid,
  title text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_minutes integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS time_entries_scope_started_idx ON time_entries (scope, scope_id, started_at DESC);
CREATE INDEX IF NOT EXISTS time_entries_started_idx ON time_entries (started_at DESC);
CREATE INDEX IF NOT EXISTS time_entries_active_idx ON time_entries (started_at DESC) WHERE deleted_at IS NULL AND ended_at IS NULL;

CREATE INDEX IF NOT EXISTS inquiries_search_trgm_idx ON inquiries USING GIN (
  lower(
    coalesce(inquirer_name, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce(phone, '') || ' ' ||
    coalesce(event_location, '') || ' ' ||
    coalesce(referral_source, '') || ' ' ||
    coalesce(message, '') || ' ' ||
    coalesce(notes, '')
  ) gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS sessions_search_trgm_idx ON sessions USING GIN (
  lower(
    coalesce(title, '') || ' ' ||
    coalesce(location_name, '') || ' ' ||
    coalesce(location_address, '') || ' ' ||
    coalesce(second_shooter_name, '') || ' ' ||
    coalesce(assistant_name, '') || ' ' ||
    coalesce(notes, '')
  ) gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS galleries_search_trgm_idx ON galleries USING GIN (
  lower(
    coalesce(slug, '') || ' ' ||
    coalesce(title, '') || ' ' ||
    coalesce(description, '')
  ) gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS smart_files_search_trgm_idx ON smart_files USING GIN (
  lower(
    coalesce(title, '') || ' ' ||
    coalesce(subject, '') || ' ' ||
    coalesce(message, '') || ' ' ||
    coalesce(recipient_email, '') || ' ' ||
    coalesce(recipient_phone, '')
  ) gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS studio_spaces_search_trgm_idx ON studio_spaces USING GIN (
  lower(
    coalesce(name, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(house_rules, '')
  ) gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS tasks_search_trgm_idx ON tasks USING GIN (
  lower(
    coalesce(title, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(blocked_reason, '') || ' ' ||
    coalesce(notes, '')
  ) gin_trgm_ops
);
