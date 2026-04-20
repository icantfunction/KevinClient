-- Stage 7 Studio Rental Schema Purpose
CREATE TABLE IF NOT EXISTS studio_spaces (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text,
  capacity integer NOT NULL DEFAULT 1,
  hourly_rate_cents integer NOT NULL DEFAULT 0,
  half_day_rate_cents integer NOT NULL DEFAULT 0,
  full_day_rate_cents integer NOT NULL DEFAULT 0,
  min_booking_hours integer NOT NULL DEFAULT 1,
  buffer_minutes integer NOT NULL DEFAULT 0,
  amenities text[] NOT NULL DEFAULT '{}'::text[],
  included_equipment text[] NOT NULL DEFAULT '{}'::text[],
  house_rules text,
  cover_image_s3_key text,
  gallery_image_s3_keys text[] NOT NULL DEFAULT '{}'::text[],
  availability_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS studio_spaces_active_name_idx ON studio_spaces (active, name);

CREATE TABLE IF NOT EXISTS studio_equipment (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text,
  hourly_rate_cents integer NOT NULL DEFAULT 0,
  daily_rate_cents integer NOT NULL DEFAULT 0,
  replacement_cost_cents integer NOT NULL DEFAULT 0,
  quantity_owned integer NOT NULL DEFAULT 0,
  quantity_available integer NOT NULL DEFAULT 0,
  condition_notes text,
  last_serviced_at timestamptz,
  images text[] NOT NULL DEFAULT '{}'::text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS studio_equipment_active_name_idx ON studio_equipment (active, name);

CREATE TABLE IF NOT EXISTS studio_bookings (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id),
  space_id uuid NOT NULL REFERENCES studio_spaces(id),
  status varchar(32) NOT NULL DEFAULT 'inquiry',
  booking_start timestamptz NOT NULL,
  booking_end timestamptz NOT NULL,
  duration_hours numeric(10, 2) GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (booking_end - booking_start)) / 3600.0) STORED,
  party_size integer,
  purpose text,
  needs_cleanup_crew boolean NOT NULL DEFAULT false,
  needs_lighting_assist boolean NOT NULL DEFAULT false,
  pricing_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  deposit_amount_cents integer NOT NULL DEFAULT 0,
  deposit_paid boolean NOT NULL DEFAULT false,
  balance_due_at timestamptz,
  balance_paid boolean NOT NULL DEFAULT false,
  liability_waiver_id uuid,
  access_code varchar(6),
  access_valid_from timestamptz,
  access_valid_until timestamptz,
  checkin_at timestamptz,
  checkout_at timestamptz,
  damage_noted boolean NOT NULL DEFAULT false,
  damage_notes text,
  damage_charge_cents integer NOT NULL DEFAULT 0,
  review_rating integer,
  review_text text,
  hold_expires_at timestamptz,
  notes text,
  booking_range tstzrange GENERATED ALWAYS AS (tstzrange(booking_start, booking_end, '[)')) STORED,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT studio_bookings_time_order_chk CHECK (booking_end > booking_start),
  CONSTRAINT studio_bookings_review_rating_chk CHECK (review_rating IS NULL OR review_rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS studio_bookings_client_start_idx ON studio_bookings (client_id, booking_start);
CREATE INDEX IF NOT EXISTS studio_bookings_space_start_idx ON studio_bookings (space_id, booking_start);
CREATE INDEX IF NOT EXISTS studio_bookings_status_start_idx ON studio_bookings (status, booking_start);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'studio_bookings_space_booking_excl'
  ) THEN
    ALTER TABLE studio_bookings
      ADD CONSTRAINT studio_bookings_space_booking_excl
      EXCLUDE USING gist (
        space_id WITH =,
        booking_range WITH &&
      )
      WHERE (deleted_at IS NULL AND status IN ('hold', 'confirmed', 'in_use'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS studio_booking_equipment_items (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES studio_bookings(id),
  equipment_id uuid NOT NULL REFERENCES studio_equipment(id),
  quantity integer NOT NULL DEFAULT 1,
  hourly_rate_cents integer NOT NULL DEFAULT 0,
  daily_rate_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT studio_booking_equipment_items_quantity_chk CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS studio_booking_equipment_items_booking_equipment_idx
  ON studio_booking_equipment_items (booking_id, equipment_id);
CREATE INDEX IF NOT EXISTS studio_booking_equipment_items_equipment_idx
  ON studio_booking_equipment_items (equipment_id);

CREATE TABLE IF NOT EXISTS studio_access_attempts (
  id uuid PRIMARY KEY,
  booking_id uuid REFERENCES studio_bookings(id),
  access_code varchar(6) NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid boolean NOT NULL DEFAULT false,
  source_ip text,
  user_agent text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS studio_access_attempts_booking_attempted_idx
  ON studio_access_attempts (booking_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS studio_access_attempts_code_attempted_idx
  ON studio_access_attempts (access_code, attempted_at DESC);

CREATE OR REPLACE FUNCTION refresh_studio_equipment_quantity_available(p_equipment_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE studio_equipment equipment
  SET
    quantity_available = GREATEST(
      equipment.quantity_owned - COALESCE((
        SELECT SUM(item.quantity)
        FROM studio_booking_equipment_items item
        JOIN studio_bookings booking ON booking.id = item.booking_id
        WHERE item.deleted_at IS NULL
          AND booking.deleted_at IS NULL
          AND booking.status IN ('hold', 'confirmed', 'in_use')
          AND item.equipment_id = p_equipment_id
      ), 0),
      0
    ),
    updated_at = CURRENT_TIMESTAMP,
    version = equipment.version + 1
  WHERE equipment.id = p_equipment_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION studio_booking_equipment_refresh_trigger()
RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'DELETE' THEN
    PERFORM refresh_studio_equipment_quantity_available(NEW.equipment_id);
  END IF;

  IF TG_OP <> 'INSERT' THEN
    PERFORM refresh_studio_equipment_quantity_available(OLD.equipment_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS studio_booking_equipment_refresh_on_item ON studio_booking_equipment_items;
CREATE TRIGGER studio_booking_equipment_refresh_on_item
AFTER INSERT OR UPDATE OR DELETE ON studio_booking_equipment_items
FOR EACH ROW
EXECUTE FUNCTION studio_booking_equipment_refresh_trigger();

CREATE OR REPLACE FUNCTION studio_booking_status_refresh_trigger()
RETURNS trigger AS $$
DECLARE
  equipment_row record;
BEGIN
  FOR equipment_row IN
    SELECT DISTINCT equipment_id
    FROM studio_booking_equipment_items
    WHERE booking_id = COALESCE(NEW.id, OLD.id)
      AND deleted_at IS NULL
  LOOP
    PERFORM refresh_studio_equipment_quantity_available(equipment_row.equipment_id);
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS studio_booking_status_refresh_on_booking ON studio_bookings;
CREATE TRIGGER studio_booking_status_refresh_on_booking
AFTER UPDATE OF status, deleted_at ON studio_bookings
FOR EACH ROW
EXECUTE FUNCTION studio_booking_status_refresh_trigger();
