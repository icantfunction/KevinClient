-- Stage 11.5 Event Outbox Schema Purpose
CREATE TABLE IF NOT EXISTS event_outbox (
  id uuid PRIMARY KEY,
  entity_type varchar(120) NOT NULL,
  entity_id uuid NOT NULL,
  event_name varchar(120) NOT NULL,
  detail jsonb NOT NULL,
  published_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS event_outbox_published_created_idx ON event_outbox (published_at, created_at);
CREATE INDEX IF NOT EXISTS event_outbox_entity_idx ON event_outbox (entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS event_outbox_attempt_idx ON event_outbox (attempt_count, created_at);
CREATE INDEX IF NOT EXISTS event_outbox_pending_created_idx
  ON event_outbox (created_at, id)
  WHERE published_at IS NULL;
