-- Stage 5 Smart Files Schema Purpose
CREATE TABLE IF NOT EXISTS smart_file_templates (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  category varchar(80) NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  latest_version_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS smart_file_templates_name_idx ON smart_file_templates (name);

CREATE TABLE IF NOT EXISTS smart_file_template_versions (
  id uuid PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES smart_file_templates(id),
  version_number integer NOT NULL,
  title text NOT NULL,
  description text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS smart_file_template_versions_template_version_idx
  ON smart_file_template_versions (template_id, version_number);

CREATE TABLE IF NOT EXISTS smart_files (
  id uuid PRIMARY KEY,
  template_id uuid REFERENCES smart_file_templates(id),
  template_version_id uuid REFERENCES smart_file_template_versions(id),
  client_id uuid REFERENCES clients(id),
  inquiry_id uuid REFERENCES inquiries(id),
  session_id uuid REFERENCES sessions(id),
  title text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'draft',
  recipient_email text,
  recipient_phone text,
  subject text,
  message text,
  sent_at timestamptz,
  viewed_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  scheduled_send_at timestamptz,
  snapshot_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  audit_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_s3_key text,
  last_public_token_at timestamptz,
  last_public_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS smart_files_status_idx ON smart_files (status, sent_at);
CREATE INDEX IF NOT EXISTS smart_files_client_idx ON smart_files (client_id, created_at);

CREATE TABLE IF NOT EXISTS smart_file_signatures (
  id uuid PRIMARY KEY,
  smart_file_id uuid NOT NULL REFERENCES smart_files(id),
  signature_method varchar(16) NOT NULL,
  signature_name text NOT NULL,
  signature_svg text,
  signature_image_s3_key text,
  signed_at timestamptz NOT NULL,
  signer_ip text,
  signer_user_agent text,
  signer_geolocation jsonb NOT NULL DEFAULT '{}'::jsonb,
  document_hash_at_signing text NOT NULL,
  verification_phone text,
  verification_verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS smart_file_signatures_smart_file_idx ON smart_file_signatures (smart_file_id, signed_at);
