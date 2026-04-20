-- Stage 3 Inquiry and Communications Schema Purpose
CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY,
  inquirer_name text NOT NULL,
  email text,
  phone text,
  event_type varchar(40) NOT NULL,
  event_date timestamptz,
  event_location text,
  estimated_guest_count integer,
  budget_range text,
  referral_source text,
  message text,
  status varchar(32) NOT NULL DEFAULT 'new',
  lost_reason text,
  assigned_smart_file_id uuid,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS inquiries_status_idx ON inquiries (status, event_date);
CREATE INDEX IF NOT EXISTS inquiries_email_idx ON inquiries (email);
CREATE INDEX IF NOT EXISTS inquiries_phone_idx ON inquiries (phone);
CREATE INDEX IF NOT EXISTS inquiries_search_trgm_idx ON inquiries USING GIN (
  lower(
    coalesce(inquirer_name, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce(phone, '') || ' ' ||
    coalesce(event_location, '') || ' ' ||
    coalesce(message, '')
  ) gin_trgm_ops
);
