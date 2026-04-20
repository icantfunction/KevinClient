-- Stage 2 Data API Enum Compatibility Purpose
ALTER TABLE clients
  ALTER COLUMN client_type TYPE varchar(32) USING client_type::text;

ALTER TABLE activities
  ALTER COLUMN channel TYPE varchar(24) USING channel::text,
  ALTER COLUMN direction TYPE varchar(24) USING direction::text;

ALTER TABLE tasks
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN priority DROP DEFAULT;

ALTER TABLE tasks
  ALTER COLUMN scope TYPE varchar(32) USING scope::text,
  ALTER COLUMN status TYPE varchar(32) USING status::text,
  ALTER COLUMN priority TYPE varchar(32) USING priority::text;

ALTER TABLE tasks
  ALTER COLUMN status SET DEFAULT 'todo',
  ALTER COLUMN priority SET DEFAULT 'medium';

DROP TYPE IF EXISTS client_type;
DROP TYPE IF EXISTS activity_channel;
DROP TYPE IF EXISTS activity_direction;
DROP TYPE IF EXISTS task_scope;
DROP TYPE IF EXISTS task_status;
DROP TYPE IF EXISTS task_priority;
