-- Stage 11 Stripe Schema Purpose
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_transaction_unique_idx
  ON payments (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL AND deleted_at IS NULL;
