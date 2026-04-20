-- Stage 6 Galleries Migration Purpose
CREATE TABLE galleries (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at timestamptz,
  version integer NOT NULL,
  session_id uuid REFERENCES sessions(id),
  slug varchar(160) NOT NULL,
  title text NOT NULL,
  description text,
  cover_photo_id uuid,
  status varchar(32) NOT NULL DEFAULT 'processing',
  expected_photo_count integer NOT NULL DEFAULT 0,
  processed_photo_count integer NOT NULL DEFAULT 0,
  delivered_at timestamptz,
  expires_at timestamptz,
  download_pin varchar(6),
  watermark_enabled boolean NOT NULL DEFAULT false,
  ai_tagging_enabled boolean NOT NULL DEFAULT false,
  client_can_favorite boolean NOT NULL DEFAULT true,
  client_can_download boolean NOT NULL DEFAULT true,
  client_can_share boolean NOT NULL DEFAULT true,
  print_store_enabled boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  unique_visitor_count integer NOT NULL DEFAULT 0
);

CREATE INDEX galleries_slug_idx ON galleries(slug);
CREATE INDEX galleries_status_idx ON galleries(status, created_at);
CREATE INDEX galleries_session_idx ON galleries(session_id, created_at);

CREATE TABLE photos (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at timestamptz,
  version integer NOT NULL,
  gallery_id uuid NOT NULL REFERENCES galleries(id),
  original_s3_key text NOT NULL,
  web_s3_key text NOT NULL,
  thumb_s3_key text NOT NULL,
  watermarked_s3_key text,
  source_filename text,
  content_type text,
  width integer,
  height integer,
  file_size_bytes bigint,
  taken_at timestamptz,
  camera_make text,
  camera_model text,
  lens text,
  iso integer,
  aperture text,
  shutter_speed text,
  focal_length text,
  gps_coords jsonb NOT NULL DEFAULT '{}'::jsonb,
  color_labels text[] NOT NULL DEFAULT '{}'::text[],
  rating integer,
  hidden_from_client boolean NOT NULL DEFAULT false,
  favorited_by_client boolean NOT NULL DEFAULT false,
  download_count integer NOT NULL DEFAULT 0,
  ai_tags jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX photos_gallery_created_idx ON photos(gallery_id, created_at);
CREATE INDEX photos_gallery_taken_idx ON photos(gallery_id, taken_at);

ALTER TABLE sessions
  ADD CONSTRAINT sessions_gallery_id_fkey
  FOREIGN KEY (gallery_id) REFERENCES galleries(id);
