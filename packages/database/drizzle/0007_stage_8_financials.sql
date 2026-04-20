-- Stage 8 Financial Schema Purpose
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id),
  source_type varchar(32) NOT NULL,
  source_id uuid,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal_cents integer NOT NULL DEFAULT 0,
  tax_cents integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  paid_cents integer NOT NULL DEFAULT 0,
  balance_cents integer NOT NULL DEFAULT 0,
  status varchar(32) NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  payment_method_note text,
  refund_amount_cents integer NOT NULL DEFAULT 0,
  refund_reason text,
  pdf_s3_key text,
  payment_provider_id text,
  currency_code varchar(3) NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS invoices_client_due_idx ON invoices (client_id, due_at);
CREATE INDEX IF NOT EXISTS invoices_source_idx ON invoices (source_type, source_id);
CREATE INDEX IF NOT EXISTS invoices_status_due_idx ON invoices (status, due_at);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  amount_cents integer NOT NULL,
  method varchar(64) NOT NULL,
  reference_note text,
  received_at timestamptz NOT NULL,
  recorded_by varchar(64) NOT NULL DEFAULT 'kevin',
  pdf_receipt_s3_key text,
  provider_transaction_id text,
  currency_code varchar(3) NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS payments_invoice_received_idx ON payments (invoice_id, received_at);
CREATE INDEX IF NOT EXISTS payments_provider_transaction_idx ON payments (provider_transaction_id);

CREATE TABLE IF NOT EXISTS expense_receipt_scans (
  id uuid PRIMARY KEY,
  receipt_s3_key text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  file_name text,
  content_type text,
  vendor text,
  receipt_date timestamptz,
  total_cents integer,
  tax_cents integer,
  ocr_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS expense_receipt_scans_receipt_key_idx ON expense_receipt_scans (receipt_s3_key);
CREATE INDEX IF NOT EXISTS expense_receipt_scans_status_created_idx ON expense_receipt_scans (status, created_at);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY,
  spent_at timestamptz NOT NULL,
  category varchar(32) NOT NULL,
  description text NOT NULL,
  amount_cents integer NOT NULL,
  payment_method varchar(64),
  vendor text,
  receipt_s3_key text,
  receipt_scan_id uuid REFERENCES expense_receipt_scans(id),
  tax_deductible boolean NOT NULL DEFAULT true,
  project_id uuid,
  notes text,
  currency_code varchar(3) NOT NULL DEFAULT 'USD',
  ocr_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS expenses_category_spent_idx ON expenses (category, spent_at);
CREATE INDEX IF NOT EXISTS expenses_receipt_scan_idx ON expenses (receipt_scan_id);
CREATE INDEX IF NOT EXISTS expenses_vendor_spent_idx ON expenses (vendor, spent_at);
