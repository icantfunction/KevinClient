-- Stage 4 Sessions, Shot Lists, and Calendar Schema Purpose
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id),
  session_type varchar(40) NOT NULL,
  title text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'scheduled',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  location_name text,
  location_address text,
  location_coords jsonb NOT NULL DEFAULT '{}'::jsonb,
  location_notes text,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  second_shooter_name text,
  assistant_name text,
  gear_notes text,
  shot_list_id uuid,
  contract_id uuid,
  questionnaire_response_id uuid,
  invoice_ids text[] NOT NULL DEFAULT '{}'::text[],
  gallery_id uuid,
  weather_forecast jsonb NOT NULL DEFAULT '{}'::jsonb,
  uses_own_studio boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS sessions_client_scheduled_idx ON sessions (client_id, scheduled_start);
CREATE INDEX IF NOT EXISTS sessions_status_scheduled_idx ON sessions (status, scheduled_start);

CREATE TABLE IF NOT EXISTS shot_lists (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL UNIQUE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS shot_lists_session_idx ON shot_lists (session_id);
